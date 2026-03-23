import pandas as pd
from prophet import Prophet
import logging
from datetime import datetime

from backend.database.db_helper import run_query, run_command, run_command_batch
from backend.logger import get_logger

logger = get_logger(__name__)

# Prophet loglarını temizlemek için
logging.getLogger('cmdstanpy').setLevel(logging.WARNING)
logging.getLogger('prophet').setLevel(logging.WARNING)

def run_prophet_by_item(item_id, target_year):
    """Tek bir ürün için Prophet tahminini çalıştırır ve sonucu döner."""
    
    query = """
    SELECT date_trunc('month', date) as ds, SUM(amount) as y 
    FROM sales_out_history 
    WHERE item_id = %s 
    GROUP BY date_trunc('month', date)
    ORDER BY ds
    """
    df = run_query(query, (item_id,))
    
    if df.empty or len(df) < 5: 
        logger.warning(f"Skipping {item_id}: Yetersiz veri ({len(df)} kayıt)")
        return []

    # Tarihi datetime formatına çevir
    df['ds'] = pd.to_datetime(df['ds']).dt.tz_localize(None)
    
    # EKSİK AYLARI SIFIR İLE DOLDURMA KODU (Resampling)
    # Hiç satışın olmadığı aylarda "0" değerinin veritabanına eklenmesi gibi çalışır.
    df = df.sort_values('ds').set_index('ds')
    df = df.resample('MS').sum().fillna(0).reset_index()

    try:
        model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=False,
            daily_seasonality=False,
            changepoint_prior_scale=0.1  # 0.01 den 0.1 e çıkarıldı: Trend son değişikliklere daha agresif uyar
        )
        model.fit(df)
        
        start_date = datetime(target_year, 1, 1)
        future_dates = pd.date_range(start=start_date, periods=12, freq='MS')
        future = pd.DataFrame({'ds': future_dates})
        
        forecast = model.predict(future)
        
        results = []
        for _, row in forecast.iterrows():
            pred_value = max(0, row['yhat'])
            lower = max(0, row['yhat_lower'])
            upper = max(0, row['yhat_upper'])
            results.append((item_id, row['ds'].date(), round(pred_value, 2), round(lower, 2), round(upper, 2)))
            
        return results

    except Exception as e:
        logger.error(f"Error forecasting {item_id}: {e}")
        return []

def run_full_analysis():
    """Sistemdeki tüm ürünler için tahmini çalıştırır ve DB'ye yazar."""
    logger.info("Prophet Analizi Başlıyor...")
    
    target_year = datetime.now().year + 1
    logger.info(f"Hedef Yıl: {target_year}")

    items_df = run_query("SELECT DISTINCT item_id FROM sales_out_history")
    items = items_df['item_id'].tolist()
    
    if not items:
        logger.warning("Analiz edilecek geçmiş veri bulunamadı.")
        return

    logger.info("Tahminler hesaplanıyor...")
    all_forecasts = []
    for item_id in items:
        forecasts = run_prophet_by_item(item_id, target_year)
        if forecasts:
            all_forecasts.extend(forecasts)
    
    if not all_forecasts:
        logger.warning("Tahmin üretilemedi.")
        return

    logger.info(f"Toplam {len(all_forecasts)} aylık tahmin üretildi. DB güncelleniyor...")

    # A. Mevcut verileri history tablosuna yedekle (eğer onaylanmamışsa)
    run_command("""
    INSERT INTO prophet_table_history (item_id, date, amount, yhat_lower, yhat_upper)
    SELECT item_id, date, amount, yhat_lower, yhat_upper FROM prophet_table_temporary
    ON CONFLICT (item_id, date) DO NOTHING
    """)

    # B. Temizle
    run_command("TRUNCATE TABLE prophet_table_temporary")

    # C. Yeni tahminleri kaydet
    insert_query = """
    INSERT INTO prophet_table_temporary (item_id, date, amount, yhat_lower, yhat_upper)
    VALUES (%s, %s, %s, %s, %s)
    ON CONFLICT (item_id, date) DO UPDATE SET amount = EXCLUDED.amount,
        yhat_lower = EXCLUDED.yhat_lower, yhat_upper = EXCLUDED.yhat_upper
    """
    if run_command_batch(insert_query, all_forecasts):
        logger.info("Kayıt başarılı.")
    else:
        logger.error("Kayıt sırasında hata oluştu!")

    logger.info(f"Analiz Tamamlandı.")

if __name__ == "__main__":
    run_full_analysis()
