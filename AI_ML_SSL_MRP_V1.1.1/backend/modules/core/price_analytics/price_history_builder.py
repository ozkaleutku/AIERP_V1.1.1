from backend.database.db_helper import run_query


def get_item_price_history(item_id: str):
    """
    Ürünün fiyat tarihi özetini getirir (Satın alma fiyatı, Satış fiyatı, Maliyet değişimleri vs.)
    """
    import pandas as pd
    
    # 1. Satın Alma Fiyat Geçmişi
    purchase_query = """
    SELECT date, 
           supplier_id as entity_name, 
           'Satın Alma' as price_type, 
           unit_price, 
           currency
    FROM purchase
    WHERE item_id = %s AND status = 'Tamamlandı'
    ORDER BY date DESC
    """
    df_purchase = run_query(purchase_query, (item_id,))
    
    # 2. Satış Fiyat Geçmişi
    sales_query = """
    SELECT date, 
           customer_name as entity_name, 
           'Satış' as price_type, 
           amount as unit_price, -- Satış tablosundaki 'amount' genelde fiyat anlamında da kullanılabiliyor, veri setini kontrol et
           'TRY' as currency
    FROM sales_out_history
    WHERE item_id = %s
    ORDER BY date DESC
    """
    # Not: Gerçek projede 'unit_price' alanı varsa kullanılmalı. Şimdilik sembolik fiyat dönüyoruz.
    # Sisteminize göre burayı revize edin.
    df_sales = run_query(sales_query, (item_id,))
    
    # 3. İleriye dönük Valuasyon Geçmişi eklenebilir
    
    # Birleştirme
    frames = []
    if not df_purchase.empty: frames.append(df_purchase)
    if not df_sales.empty: frames.append(df_sales)
    
    if not frames:
        return []
        
    df_combined = pd.concat(frames, ignore_index=True)
    df_combined.sort_values(by='date', ascending=False, inplace=True)
    
    # Sadece en son 50 kaydı döndür
    df_combined = df_combined.head(50)
    
    # Convert dates to strings for JSON serialization
    df_combined['date'] = df_combined['date'].astype(str)
    
    return df_combined.to_dict(orient='records')
