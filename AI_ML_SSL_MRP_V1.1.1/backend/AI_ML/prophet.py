import pandas as pd
from prophet import Prophet
import logging
from datetime import datetime
import sys
import os

# Add backend root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database.db_helper import run_query, run_command, run_command_batch

# Prophet loglarını temizlemek için
logging.getLogger('cmdstanpy').setLevel(logging.WARNING)
logging.getLogger('prophet').setLevel(logging.WARNING)

def run_prophet_by_item(item_id, target_year):
    """
    Tek bir ürün için Prophet tahminini çalıştırır ve sonucu döner.
    Dönüş formatı: [(item_id, date, amount), ...] listesi
    """
    # 1. Veriyi Çek
    query = """
    SELECT date as ds, amount as y 
    FROM sales_out_history 
    WHERE item_id = %s 
    ORDER BY date
    """
    df = run_query(query, (item_id,))
    
    if df.empty or len(df) < 5: 
        print(f"Skipping {item_id}: Yetersiz veri ({len(df)} kayıt)")
        return []

    # Tarihi datetime formatına çevir
    df['ds'] = pd.to_datetime(df['ds'])
    
    # Aynı güne denk gelen satışları topla (Prophet kuralı: Tekrar eden tarih olmamalı)
    df = df.groupby('ds')['y'].sum().reset_index()

    try:
        # 2. Modeli Eğit
        model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=False,
            daily_seasonality=False,
            changepoint_prior_scale=0.01 
        )
        model.fit(df)
        
        # 3. Gelecek Yılın Takvimini Oluştur
        start_date = datetime(target_year, 1, 1)
        future_dates = pd.date_range(start=start_date, periods=12, freq='MS')
        future = pd.DataFrame({'ds': future_dates})
        
        # 4. Tahmin Yap
        forecast = model.predict(future)
        
        # 5. Sonuçları Hazırla
        results = []
        for _, row in forecast.iterrows():
            pred_value = max(0, row['yhat'])
            results.append((item_id, row['ds'].date(), round(pred_value, 2)))
            
        return results

    except Exception as e:
        print(f"Error forecasting {item_id}: {e}")
        return []

def run_full_analysis():
    """
    Sistemdeki tüm ürünler için tahmini çalıştırır ve veritabanına yazar.
    """
    print("Prophet Analizi Başlıyor...")
    
    # Gelecek yıl: Bugünden bir sonraki yıl
    target_year = datetime.now().year + 1
    print(f"Hedef Yıl: {target_year}")

    # 1. Benzersiz Ürünleri Bul
    items_df = run_query("SELECT DISTINCT item_id FROM sales_out_history")
    items = items_df['item_id'].tolist()
    
    if not items:
        print("Analiz edilecek geçmiş veri bulunamadı.")
        return

    # 2. Her Ürün İçin Tahmin Yap (Hafızada Topla)
    print("Tahminler hesaplanıyor...")
    all_forecasts = []
    for item_id in items:
        forecasts = run_prophet_by_item(item_id, target_year)
        if forecasts:
            all_forecasts.extend(forecasts)
    
    if not all_forecasts:
        print("Tahmin üretilemedi.")
        return

    print(f"Toplam {len(all_forecasts)} aylık tahmin üretildi. Veritabanı güncelleniyor...")

    # 3. Veritabanı İşlemleri (Transaction benzeri güvenlik)
    # A. Mevcut verileri History tablosuna yedekle
    print("Mevcut geçici veriler history tablosuna yedekleniyor...")
    run_command("""
    INSERT INTO prophet_table_history (item_id, date, amount)
    SELECT item_id, date, amount FROM prophet_table_temporary
    ON CONFLICT (item_id, date) DO NOTHING
    """)

    # B. Temporary Tablosunu Temizle
    print("Geçici tablo temizleniyor...")
    run_command("TRUNCATE TABLE prophet_table_temporary")

    # C. Yeni Verileri Kaydet
    print("Yeni tahminler kaydediliyor...")
    insert_query = """
    INSERT INTO prophet_table_temporary (item_id, date, amount)
    VALUES (%s, %s, %s)
    ON CONFLICT (item_id, date) DO UPDATE SET amount = EXCLUDED.amount
    """
    if run_command_batch(insert_query, all_forecasts):
        print("Kayıt başarılı.")
    else:
        print("Kayıt sırasında hata oluştu!")

    print(f"Analiz Tamamlandı.")

if __name__ == "__main__":
    run_full_analysis()
