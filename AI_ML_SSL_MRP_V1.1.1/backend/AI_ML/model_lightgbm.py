import pandas as pd
import numpy as np
import lightgbm as lgb
from datetime import datetime
import warnings
from backend.database.db_helper import run_query, run_command, run_command_batch
from backend.logger import get_logger

# Disable warnings for cleaner logs
warnings.filterwarnings('ignore')
logger = get_logger(__name__)

def run_lightgbm_training():
    """
    Trains a LightGBM Quantile Regression model to predict safety stock.
    Learns from:
    - Prophet History (past forecasts)
    - AI History (past safety stock suggestions)
    - Historical Consumption (BOM-exploded actual requirement)
    - Monthly/Yearly trends
    """
    logger.info("1. Veritabanindan Gecmis Veriler Cekiliyor...")
    
    # --- A. Historical Context Data ---
    
    # 1. Past Prophet Forecasts
    prophet_query = "SELECT item_id, date, amount as prophet_forecast FROM prophet_table_history"
    df_prophet_hist = run_query(prophet_query)
    
    # 2. Past AI Safety Stock Suggestions
    ai_hist_query = "SELECT item_id, date, amount as past_ss_ai FROM ss_ai_history"
    df_ai_hist = run_query(ai_hist_query)
    
    # 3. True Historical Requirement (The Target)
    # This is the BOM-exploded consumption calculated by historical_consumption.py
    cons_query = "SELECT item_id, date, amount as actual_requirement FROM historical_consumption"
    df_cons_hist = run_query(cons_query)
    
    if df_cons_hist.empty:
        logger.warning("Historical consumption (target) verisi bulunamadı! Lütfen önce explosion çalıştırın.")
        return

    # --- B. Future Context (Prediction Candidates) ---
    
    # 4. Current Prophet Forecasts for Next Year
    df_prophet_temp = run_query("SELECT item_id, date, amount as prophet_forecast FROM prophet_table_temporary")
    
    # --- C. Master Data & Risk Parameters ---
    
    item_query = """
    SELECT DISTINCT ON (i.item_id)
        i.item_id, i.item_type, i.item_quantity_type,
        sk.result_king, sk.leadtime_avg, sk.leadtime_deviation
    FROM item i
    LEFT JOIN ss_kings_formula sk ON i.item_id = sk.item_id
    ORDER BY i.item_id, sk.leadtime_avg ASC NULLS LAST
    """
    df_master = run_query(item_query)

    # ---------------------------------------------------------
    # 2. MONTHLY DATA ALIGNMENT
    # ---------------------------------------------------------
    logger.info("2. Veriler Aylik Bazda Hizalaniyor...")

    # Convert all dates to datetime and extract year/month for exact matching
    def process_dates(df, date_col='date'):
        df[date_col] = pd.to_datetime(df[date_col])
        df['year'] = df[date_col].dt.year
        df['month'] = df[date_col].dt.month
        return df

    df_cons_hist = process_dates(df_cons_hist)
    df_prophet_hist = process_dates(df_prophet_hist)
    df_ai_hist = process_dates(df_ai_hist)
    
    # Base training set from consumption history
    df_train = df_cons_hist.copy()
    
    # Merge Features
    df_train = df_train.merge(df_prophet_hist[['item_id', 'year', 'month', 'prophet_forecast']], on=['item_id', 'year', 'month'], how='left')
    df_train = df_train.merge(df_ai_hist[['item_id', 'year', 'month', 'past_ss_ai']], on=['item_id', 'year', 'month'], how='left')
    df_train = df_train.merge(df_master, on='item_id', how='left')

    # Fill NaNs with 0
    df_train = df_train.fillna(0)

    # Add Lagged Features (Algorithm learns pattern from previous months)
    df_train = df_train.sort_values(['item_id', 'year', 'month'])
    df_train['prev_month_req'] = df_train.groupby('item_id')['actual_requirement'].shift(1).fillna(0)
    df_train['prev_month_err'] = (df_train['actual_requirement'] - df_train['prophet_forecast'].shift(1)).fillna(0)

    # ---------------------------------------------------------
    # 3. TRAINING
    # ---------------------------------------------------------
    logger.info("3. Model Egitiliyor (Algoritmik Ogrenme)...")
    
    features = [
        'year', 'month', 'prophet_forecast', 'past_ss_ai', 
        'result_king', 'leadtime_avg', 'leadtime_deviation',
        'prev_month_req', 'prev_month_err'
    ]
    
    cat_features = ['item_type', 'item_quantity_type']
    all_features = features + cat_features
    
    for c in cat_features:
        df_train[c] = df_train[c].astype('category')

    # Target: The actual exploded requirement
    X = df_train[all_features]
    y = df_train['actual_requirement']

    model = lgb.LGBMRegressor(
        objective='quantile',
        alpha=0.85, # Less aggressive than 0.95 to avoid extreme outlier spikes
        n_estimators=300,
        learning_rate=0.07,
        max_depth=5,
        num_leaves=20,
        random_state=42,
        verbose=-1
    )
    
    model.fit(X, y)
    logger.info("✓ Model egitimi tamamlandi.")

    # ---------------------------------------------------------
    # 4. PREDICTION FOR NEXT YEAR
    # ---------------------------------------------------------
    logger.info("4. Gelecek Donem Tahminleri Yapiliyor...")
    
    df_prophet_temp = process_dates(df_prophet_temp)
    target_year = datetime.now().year + 1
    df_future = df_prophet_temp[df_prophet_temp['year'] == target_year].copy()
    
    if df_future.empty:
        logger.warning(f"{target_year} için Prophet verisi bulunamadı.")
        return

    # Prepare features for prediction
    df_future = df_future.merge(df_master, on='item_id', how='left')
    
    # Use most recent history for lagged features in prediction
    recent_stats = df_train.groupby('item_id').tail(1).rename(columns={
        'actual_requirement': 'prev_month_req',
        'past_ss_ai': 'past_ss_ai' # carry over last observed AI suggest
    })
    
    # Ensure all features exist and handle categories
    for c in all_features:
        if c not in df_future.columns:
            df_future[c] = 0
        if c in cat_features:
            df_future[c] = df_future[c].astype('category')
            
    logger.info(f"✓ Training features: {X.columns.tolist()}")
    logger.info(f"✓ Prediction features: {df_future[all_features].columns.tolist()}")
    logger.info(f"✓ X shape: X.shape, Future shape: {df_future[all_features].shape}")

    try:
        preds = model.predict(df_future[all_features])
        df_future['ai_ss'] = np.maximum(preds, 0)
    except Exception as e:
        logger.error(f"Prediction Error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise e

    # ---------------------------------------------------------
    # 5. SAVE RESULTS
    # ---------------------------------------------------------
    logger.info("5. Sonuclar Kaydediliyor...")
    
    # Backup current temp to history for next training run
    run_command("""
    INSERT INTO ss_ai_history (item_id, date, amount)
    SELECT item_id, date, amount FROM ss_ai_temporary
    ON CONFLICT (item_id, date) DO NOTHING
    """)
    
    run_command("TRUNCATE TABLE ss_ai_temporary")
    
    batch_data = [
        (row['item_id'], row['date'].date(), round(float(row['ai_ss']), 2))
        for _, row in df_future.iterrows()
    ]
    
    run_command_batch("INSERT INTO ss_ai_temporary (item_id, date, amount) VALUES (%s, %s, %s)", batch_data)
    logger.info(f"✅ İşlem Tamam! {len(batch_data)} tahmin oluşturuldu.")

if __name__ == "__main__":
    run_lightgbm_training()
