from backend.database.db_helper import run_query
import pandas as pd
import numpy as np


def get_item_price_history(item_id: str):
    """
    Ürünün fiyat tarihi özetini getirir (Satın alma fiyatı, Satış fiyatı, Maliyet değişimleri vs.)
    Frontend 'prices' (purchase_price, sales_price, internal_cost) yapısına uygun döner.
    """
    
    # 1. Satın Alma Fiyatları
    purchase_query = """
    SELECT purchase_date as date, 
           unit_price as purchase_price
    FROM purchase
    WHERE item_id = %s AND status = 'Tamamlandı'
    """
    df_purchase = run_query(purchase_query, (item_id,))
    
    # 2. Gerçek Satış Fiyatları
    sales_query = """
    SELECT date, 
           amount as sales_price
    FROM sales_out_history
    WHERE item_id = %s
    """
    df_sales = run_query(sales_query, (item_id,))
    
    # 3. Sistem Maliyet/Fiyat Kayıtları (Snapshotlar)
    snapshot_query = """
    SELECT date, 
           unit_cost as internal_cost,
           unit_price as sales_price_snapshot
    FROM item_price_history
    WHERE item_id = %s
    """
    df_snapshots = run_query(snapshot_query, (item_id,))
    
    # Verileri birleştirme
    frames = []
    if not df_purchase.empty: frames.append(df_purchase)
    if not df_sales.empty: frames.append(df_sales)
    if not df_snapshots.empty: frames.append(df_snapshots)
    
    if not frames:
        return []
        
    df_combined = pd.concat(frames, ignore_index=True)
    
    # Beklenen sütunları garanti altına al (Eksikse NaN ile oluştur)
    for col in ['purchase_price', 'sales_price', 'internal_cost', 'sales_price_snapshot']:
        if col not in df_combined.columns:
            df_combined[col] = np.nan

    # Tarih formatını standartlaştır
    df_combined['date'] = pd.to_datetime(df_combined['date'])
    
    # sales_price_snapshot ile sales_price'ı birleştir (snapshot'ı yedek olarak kullan)
    df_combined['sales_price'] = df_combined['sales_price'].fillna(df_combined['sales_price_snapshot'])
    df_combined.drop(columns=['sales_price_snapshot'], inplace=True)

    # Aynı tarihteki verileri grupla
    df_grouped = df_combined.groupby('date').first().reset_index()
    df_grouped.sort_values(by='date', ascending=True, inplace=True)
    
    # Sadece en son 100 kaydı döndür
    df_grouped = df_grouped.tail(100)
    
    # JSON için tarihi stringe çevir (dt.date veya strftime kullanabiliriz)
    df_grouped['date'] = df_grouped['date'].dt.strftime('%Y-%m-%d')
    
    # NaN değerleri JSON uyumluluğu için None (null) yap
    return df_grouped.replace({np.nan: None}).to_dict(orient='records')
