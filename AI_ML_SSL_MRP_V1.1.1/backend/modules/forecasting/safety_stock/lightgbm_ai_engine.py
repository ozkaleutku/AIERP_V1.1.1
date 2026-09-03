import pandas as pd
import numpy as np
import lightgbm as lgb
import logging
from datetime import datetime
import warnings

from backend.database.db_helper import run_query, run_command, run_command_batch
from backend.logger import get_logger

logger = get_logger(__name__)
warnings.filterwarnings('ignore')


def calculate_rolling_features(df_cons, until_date):
    """Her ürün için son 6 ve 12 ayın ortalama tüketimini hesaplar."""
    df_hist = df_cons[df_cons['date'] < until_date].copy()
    if df_hist.empty:
        return pd.DataFrame(columns=['item_id', 'rolling_cons_6m', 'rolling_cons_12m'])
    
    df_hist = df_hist.sort_values(['item_id', 'date'])
    results = []
    for item_id, group in df_hist.groupby('item_id'):
        results.append({
            'item_id': item_id,
            'rolling_cons_6m': group['actual_requirement'].tail(6).mean(),
            'rolling_cons_12m': group['actual_requirement'].tail(12).mean()
        })
    return pd.DataFrame(results)


def run_lightgbm_analysis():
    """
    Reference Repo Aligned LightGBM Safety Stock Analysis.
    
    Quantile Regression (alpha=0.85) ile emniyet stoğu tahmini yapar.
    Prophet tahminleri, King's formula, tedarikçi gecikme riski ve 
    rolling consumption gibi zengin özelliklerle eğitilir.
    """
    logger.info("1. Veritabanından Veriler Çekiliyor...")
    
    # A. Prophet Forecasts (History + Temporary)
    df_prophet_hist = run_query("SELECT item_id, date, amount as prophet_forecast FROM prophet_table_history")
    df_prophet_temp = run_query("SELECT item_id, date, amount as prophet_forecast FROM prophet_table_temporary")
    df_prophet = pd.concat([df_prophet_hist, df_prophet_temp])
    df_prophet['date'] = pd.to_datetime(df_prophet['date']).dt.tz_localize(None)

    # B. Actual consumption from historical_consumption (BOM-exploded)
    # Fallback: If historical_consumption is empty, use stock_movement production data
    consumption_query = """
    SELECT item_id, date_trunc('month', date) as date, SUM(amount) as actual_requirement
    FROM historical_consumption
    GROUP BY item_id, date_trunc('month', date)
    """
    df_cons = run_query(consumption_query)
    
    if df_cons.empty:
        # Fallback to stock_movement production consumption
        logger.info("   historical_consumption boş, stock_movement'tan tüketim verisi çekiliyor...")
        consumption_query_fallback = """
        SELECT item_id, date_trunc('month', date) as date,
        SUM(CASE WHEN target_location_id = 'ÜRETİM' THEN amount ELSE 0 END) - 
        SUM(CASE WHEN source_location_id = 'ÜRETİM' THEN amount ELSE 0 END) as actual_requirement
        FROM stock_movement
        WHERE (target_location_id = 'ÜRETİM' OR source_location_id = 'ÜRETİM')
        GROUP BY item_id, date_trunc('month', date)
        """
        df_cons = run_query(consumption_query_fallback)
    
    if df_cons.empty:
        logger.warning("Eğitim yapılacak tüketim verisi yok.")
        return
    df_cons['date'] = pd.to_datetime(df_cons['date']).dt.tz_localize(None)

    # C. Supplier Risk Map
    supplier_risk_query = """
    SELECT 
        item_id, 
        EXTRACT(MONTH FROM purchase_date) as month,
        MAX(GREATEST(0, delay_day)) as max_supplier_delay,
        AVG(GREATEST(0, delay_day)) as avg_supplier_delay,
        COUNT(*) FILTER (WHERE purpose = 'acil_sipariş') as urgent_count,
        COUNT(*) as total_count
    FROM purchase
    WHERE actual_coming_date IS NOT NULL
    GROUP BY item_id, month
    """
    df_supplier_risk = run_query(supplier_risk_query)
    if not df_supplier_risk.empty:
        df_supplier_risk['urgent_order_ratio'] = (df_supplier_risk['urgent_count'] / df_supplier_risk['total_count']).fillna(0)
    else:
        df_supplier_risk = pd.DataFrame(columns=['item_id', 'month', 'max_supplier_delay', 'avg_supplier_delay', 'urgent_order_ratio'])

    # D. Item Master + King's Formula
    item_query = """
    SELECT 
        i.item_id, i.item_type, i.item_quantity_type,
        sk.leadtime_avg, sk.leadtime_deviation, sk.result_king
    FROM item i
    LEFT JOIN ss_kings_formula sk ON i.item_id = sk.item_id
    """
    df_master = run_query(item_query)

    # E. Rolling Features
    predict_start_date = pd.to_datetime(f"{datetime.now().year + 1}-01-01")
    df_rolling = calculate_rolling_features(df_cons, predict_start_date)

    # 2. Prepare Training Set
    logger.info("2. Eğitim Seti Hazırlanıyor...")
    df_train = df_cons[df_cons['date'] < predict_start_date].copy()
    df_train['month'] = df_train['date'].dt.month
    
    df_train = df_train.merge(df_prophet, on=['item_id', 'date'], how='left')
    df_train = df_train.merge(df_master, on='item_id', how='left')
    if not df_supplier_risk.empty:
        df_train = df_train.merge(
            df_supplier_risk[['item_id', 'month', 'max_supplier_delay', 'avg_supplier_delay', 'urgent_order_ratio']], 
            on=['item_id', 'month'], how='left'
        )
    df_train = df_train.merge(df_rolling, on='item_id', how='left')
    df_train = df_train.fillna(0)

    # 3. Training
    logger.info("3. Model Eğitiliyor...")
    features = [
        'prophet_forecast', 'leadtime_avg', 'leadtime_deviation', 'result_king',
        'max_supplier_delay', 'avg_supplier_delay', 'urgent_order_ratio', 
        'month', 'rolling_cons_6m', 'rolling_cons_12m'
    ]
    cat_features = ['item_type', 'item_quantity_type']
    all_features = features + cat_features
    
    # Ensure all feature columns exist
    for f in all_features:
        if f not in df_train.columns:
            df_train[f] = 0
    
    for c in cat_features:
        df_train[c] = df_train[c].astype('category')

    # Quantile Regression: alpha=0.85 → %85 hizmet seviyesi
    model = lgb.LGBMRegressor(
        objective='quantile', alpha=0.85,
        n_estimators=105, learning_rate=0.03, num_leaves=31, verbose=-1, random_state=42
    )
    model.fit(df_train[all_features], df_train['actual_requirement'])

    # 4. Future Forecasts
    logger.info("4. Gelecek Tahminleri Yapılıyor...")
    target_year = datetime.now().year + 1
    
    active_items = set(df_cons['item_id'].unique()) | set(df_prophet[df_prophet['date'] >= predict_start_date]['item_id'].unique())
    items = [i for i in df_master['item_id'].unique() if i in active_items]
    dates = [pd.to_datetime(f"{target_year}-{m:02d}-01") for m in range(1, 13)]
    
    df_predict = pd.DataFrame([(i, d) for i in items for d in dates], columns=['item_id', 'date'])
    df_predict['month'] = df_predict['date'].dt.month
    df_predict = df_predict.merge(df_prophet, on=['item_id', 'date'], how='left')
    df_predict = df_predict.merge(df_master, on='item_id', how='left')
    if not df_supplier_risk.empty:
        df_predict = df_predict.merge(
            df_supplier_risk[['item_id', 'month', 'max_supplier_delay', 'avg_supplier_delay', 'urgent_order_ratio']], 
            on=['item_id', 'month'], how='left'
        )
    df_predict = df_predict.merge(df_rolling, on='item_id', how='left')
    df_predict = df_predict.fillna(0)

    # Ensure all feature columns exist
    for f in all_features:
        if f not in df_predict.columns:
            df_predict[f] = 0

    for c in cat_features:
        df_predict[c] = df_predict[c].astype('category')

    preds = model.predict(df_predict[all_features])
    df_predict['ai_amount'] = np.maximum(preds, 0)
    
    # Zero out items with no signal (no prophet forecast AND no rolling consumption)
    df_predict.loc[
        (df_predict['prophet_forecast'] == 0) & (df_predict['rolling_cons_12m'] == 0), 
        'ai_amount'
    ] = 0

    # 5. Saving Results
    logger.info("5. Sonuçlar Kaydediliyor...")
    
    # Save to safety_stock_plan (Reference Repo Aligned)
    insert_plan_query = """
    INSERT INTO safety_stock_plan (item_id, date, ai_amount, item_type, item_quantity_type, is_approved)
    VALUES (%s, %s, %s, %s, %s, FALSE)
    ON CONFLICT (item_id, date) DO UPDATE SET ai_amount = EXCLUDED.ai_amount, is_approved = FALSE;
    """
    
    # Filter to only hammadde (raw materials) for safety stock
    df_final = df_predict[df_predict['item_type'] == 'hammadde'].copy()
    batch_plan = [
        (row['item_id'], row['date'].date(), round(float(row['ai_amount']), 5), row['item_type'], row['item_quantity_type'])
        for _, row in df_final.iterrows()
    ]
    if batch_plan:
        run_command_batch(insert_plan_query, batch_plan)

    # Also save to ss_ai_temporary (Legacy compatibility for existing BOM explosion flow)
    run_command("""
    INSERT INTO ss_ai_history (item_id, date, amount)
    SELECT item_id, date, amount FROM ss_ai_temporary
    ON CONFLICT (item_id, date) DO NOTHING
    """)
    run_command("TRUNCATE TABLE ss_ai_temporary")
    
    insert_legacy_query = """
    INSERT INTO ss_ai_temporary (item_id, date, amount)
    VALUES (%s, %s, %s)
    ON CONFLICT (item_id, date) DO UPDATE SET amount = EXCLUDED.amount
    """
    batch_legacy = [
        (row['item_id'], row['date'].date(), round(float(row['ai_amount']), 5))
        for _, row in df_predict.iterrows()
    ]
    if batch_legacy:
        run_command_batch(insert_legacy_query, batch_legacy)
    
    logger.info(f"TAMAMLANDI! {len(batch_plan)} hammadde + {len(batch_legacy)} toplam tahmin oluşturuldu.")

if __name__ == "__main__":
    run_lightgbm_analysis()
