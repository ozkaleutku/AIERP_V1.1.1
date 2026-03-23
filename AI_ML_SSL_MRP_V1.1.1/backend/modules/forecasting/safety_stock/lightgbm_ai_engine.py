import pandas as pd
import lightgbm as lgb
import logging
from datetime import datetime
import numpy as np

from backend.database.db_helper import run_query, run_command, run_command_batch
from backend.logger import get_logger

logger = get_logger(__name__)

def get_supplier_delays():
    """Tedarikçilerin ürün bazında ortalama gecikme günlerini hesaplar.
    Erken gelme (negatif gecikme) durumları 0 sayılır, böylece erken gelmeler 
    gecikmeleri sıfırlayıp riski maskelemez."""
    sql = """
    SELECT item_id, 
           AVG(GREATEST(0, actual_coming_date - expected_coming_date)) as supplier_delay_days
    FROM purchase
    WHERE status = 'Tamamlandı' 
      AND actual_coming_date IS NOT NULL 
      AND expected_coming_date IS NOT NULL
    GROUP BY item_id
    """
    df = run_query(sql)
    return df

def prepare_data(df):
    """Features generating for LightGBM"""
    df['date'] = pd.to_datetime(df['date'])
    
    # EKSİK AYLARI SIFIR İLE DOLDURMA KODU (LightGBM için kritik!)
    # Eğer gruplamadan doğrudan shift yaparsak, Şubat ayı tabloda yoksa Mart'ın lag_1'i Ocak olur. (Yanlış veri)
    # Bu yüzden her ürün için ayları eksiksiz (0 satılmış olsa bile) oluşturuyoruz.
    df = df.set_index('date').groupby('item_id').resample('MS')['amount'].sum().fillna(0).reset_index()
    
    df['year'] = df['date'].dt.year
    df['month'] = df['date'].dt.month
    df['quarter'] = df['date'].dt.quarter
    
    # Lag features (Önceki ayların satışları)
    df = df.sort_values(['item_id', 'date'])
    df['lag_1'] = df.groupby('item_id')['amount'].shift(1).fillna(0)
    df['lag_2'] = df.groupby('item_id')['amount'].shift(2).fillna(0)
    df['lag_3'] = df.groupby('item_id')['amount'].shift(3).fillna(0)
    
    # Rolling mean (Son 3 ayın ortalaması)
    df['rolling_mean_3'] = df.groupby('item_id')['amount'].transform(lambda x: x.rolling(window=3, min_periods=1).mean())
    df['rolling_std_3'] = df.groupby('item_id')['amount'].transform(lambda x: x.rolling(window=3, min_periods=1).std().fillna(0))
    
    return df

def run_lightgbm_analysis():
    logger.info("Ensembled LightGBM Analizi Başlıyor...")
    target_year = datetime.now().year + 1
    logger.info(f"Hedef Yıl: {target_year}")

    # 1. TEMEL VERİYİ ÇEK (TARIHSEL TÜKETİM)
    query_hist = """
    SELECT item_id, date_trunc('month', date) as date, SUM(amount) as amount
    FROM historical_consumption
    GROUP BY item_id, date_trunc('month', date)
    ORDER BY item_id, date
    """
    df = run_query(query_hist)
    
    if df.empty:
        logger.warning("Eğitim için geçmiş tüketim verisi bulunamadı.")
        return

    df['date'] = pd.to_datetime(df['date']).dt.tz_localize(None)
    df = prepare_data(df)
    
    # 2. ÖZELLİK ZENGİNLEŞTİRME (FEATURE ENRICHMENT - ENSEMBLE)
    
    # 2.a Prophet History (Geçmiş Prophet Tahminleri)
    df_prophet_hist = run_query("SELECT item_id, date, amount as prophet_pred FROM prophet_table_history")
    if not df_prophet_hist.empty:
        df_prophet_hist['date'] = pd.to_datetime(df_prophet_hist['date']).dt.tz_localize(None)
        df = df.merge(df_prophet_hist, on=['item_id', 'date'], how='left')
    df['prophet_pred'] = df.get('prophet_pred', pd.Series(0, index=df.index)).fillna(0)
    
    # 2.b King's Formula Baseline
    df_kings = run_query("SELECT item_id, result_king as kings_baseline FROM ss_kings_formula")
    if not df_kings.empty:
        df = df.merge(df_kings, on='item_id', how='left')
    df['kings_baseline'] = df.get('kings_baseline', pd.Series(0, index=df.index)).fillna(0)
    
    # 2.c Supplier Delay Risk (Tedarikçi Gecikme Skoru)
    df_delays = get_supplier_delays()
    if not df_delays.empty:
        df = df.merge(df_delays, on='item_id', how='left')
    df['supplier_delay_days'] = df.get('supplier_delay_days', pd.Series(0, index=df.index)).fillna(0)
    
    # 3. KATEGORİK DEĞİŞKEN
    df['item_id_encoded'] = df['item_id'].astype('category').cat.codes
    item_mapping = dict(enumerate(df['item_id'].astype('category').cat.categories))

    # AI Features
    features = [
        'year', 'month', 'quarter', 
        'lag_1', 'lag_2', 'lag_3', 'rolling_mean_3', 'rolling_std_3',
        'prophet_pred', 'kings_baseline', 'supplier_delay_days',
        'item_id_encoded'
    ]
    target = 'amount'

    # 4. MODEL EĞİTİMİ (TRAINING)
    X = df[features]
    y = df[target]
    
    train_data = lgb.Dataset(X, label=y, categorical_feature=['item_id_encoded'])
    
    # Optimize Edilmiş Ensemble Parametreleri
    params = {
        'objective': 'regression',
        'metric': 'rmse',
        'boosting_type': 'gbdt',
        'learning_rate': 0.05,       # Dengeli öğrenme
        'num_leaves': 20,            # Karmaşıklığı azalttık, çünkü güçlü özellikler (Prophet) eklendi
        'feature_fraction': 0.7,     # Her ağaçta özelliklerin %70'ini kullanarak modeller arası fikir çeşitliliği sağlar
        'bagging_fraction': 0.8,     # Satır bazlı %80 tesadüfilik
        'bagging_freq': 5,           # Her 5 iterasyonda bir bagging yap
        'max_depth': 6,              # Aşırı ezberlemeyi kırmak için derinlik limiti
        'verbose': -1
    }
    
    logger.info("Ensemble Model eğitiliyor...")
    model = lgb.train(params, train_data, num_boost_round=150)
    
    # 5. GELECEĞİ TAHMİN ETME (AUTOREGRESSIVE INFERENCE)
    
    df_prophet_fut = run_query("SELECT item_id, date, amount as prophet_pred FROM prophet_table_temporary")
    if not df_prophet_fut.empty:
        df_prophet_fut['date'] = pd.to_datetime(df_prophet_fut['date']).dt.tz_localize(None)
    
    items = df['item_id'].unique()
    
    # Her ürün için o anki güncel durumu (history buffer) tutuyoruz
    current_state = {}
    for item_id in items:
        item_history = df[df['item_id'] == item_id]
        
        hist_array = list(item_history['amount'].tail(3).values)
        if len(hist_array) < 3:
            hist_array = [0] * (3 - len(hist_array)) + hist_array
            
        kings_val = item_history['kings_baseline'].iloc[-1] if not item_history.empty else 0
        delay_val = item_history['supplier_delay_days'].iloc[-1] if not item_history.empty else 0
        encoded_id = {v: k for k, v in item_mapping.items()}[item_id]
        
        current_state[item_id] = {
            'history': hist_array,  # [lag_3, lag_2, lag_1]
            'kings_baseline': kings_val,
            'supplier_delay_days': delay_val,
            'item_id_encoded': encoded_id
        }

    future_data = []
    
    # Aydan aya tahmin (Recursive Autoregressive)
    for month in range(1, 13):
        future_date = datetime(target_year, month, 1)
        quarter = (month - 1) // 3 + 1
        
        # Prophet tahminlerini o ay için bellekten (memory) çek
        prophet_dict = {}
        if not df_prophet_fut.empty:
            month_prophets = df_prophet_fut[df_prophet_fut['date'] == future_date]
            prophet_dict = dict(zip(month_prophets['item_id'], month_prophets['prophet_pred']))
            
        month_rows = []
        for item_id in items:
            state = current_state[item_id]
            hist = state['history']
            
            row = {
                'item_id': item_id,
                'date': future_date,
                'year': target_year,
                'month': month,
                'quarter': quarter,
                'lag_1': hist[-1],
                'lag_2': hist[-2],
                'lag_3': hist[-3],
                'rolling_mean_3': np.mean(hist),
                'rolling_std_3': np.std(hist),
                'prophet_pred': prophet_dict.get(item_id, 0),
                'kings_baseline': state['kings_baseline'],
                'supplier_delay_days': state['supplier_delay_days'],
                'item_id_encoded': state['item_id_encoded']
            }
            month_rows.append(row)
            
        # O ayki tüm ürünleri toplu tahmin et (Vectorized - Yüksek Performans)
        month_df = pd.DataFrame(month_rows)
        X_month = month_df[features]
        month_preds = np.maximum(0, model.predict(X_month))
        
        # Tahminleri kaydet ve state'i GÜNCELLE (Autoregressive döngü)
        for i, item_id in enumerate(items):
            pred_amount = month_preds[i]
            month_rows[i]['predicted_amount'] = pred_amount
            
            # En son tahmini history buffer'a at, en eskisini uçur
            current_state[item_id]['history'].pop(0)
            current_state[item_id]['history'].append(pred_amount)
            
        future_data.extend(month_rows)

    future_df = pd.DataFrame(future_data)

    # 6. DB'YE KAYDET
    logger.info("Tahminler DB'ye kaydediliyor...")
    
    run_command("""
    INSERT INTO ss_ai_history (item_id, date, amount, is_approved)
    SELECT item_id, date, amount, is_approved FROM ss_ai_temporary
    ON CONFLICT (item_id, date) DO NOTHING
    """)

    run_command("TRUNCATE TABLE ss_ai_temporary")
    
    insert_query = """
    INSERT INTO ss_ai_temporary (item_id, date, amount)
    VALUES (%s, %s, %s)
    """
    batch_data = [
        (row['item_id'], row['date'].date(), round(row['predicted_amount'], 2)) 
        for _, row in future_df.iterrows()
    ]
    
    run_command_batch(insert_query, batch_data)
    
    logger.info("Ensembled LightGBM Analizi Tamamlandı.")

if __name__ == "__main__":
    run_lightgbm_analysis()
