import math
from backend.database.db_helper import run_query, run_command_batch
from backend.logger import get_logger

logger = get_logger(__name__)

def run_kings_formula_analysis():
    """
    Sistemdeki tarihsel tüketim (historical_consumption) ve 
    tedarikçi bekleme sürelerini (supplier_item) kullanarak
    King's Formula ile Güvenlik Stoğu (Safety Stock) hesaplar.
    Sonuçları `ss_kings_formula` tablosuna yazar.
    """
    logger.info("King's Formula calculation started...")
    
    # 1. Günlük Ortalama Tüketim (Daily Average Consumption) ve Standart Sapması
    # Ay bazında veriyi güne bölüp ortalama/std hesaplıyoruz (Yaklaşık bir yaklaşım)
    hist_sql = """
    WITH MonthlyData AS (
        SELECT item_id, 
               EXTRACT(YEAR FROM date) as year, 
               EXTRACT(MONTH FROM date) as month,
               SUM(amount) / 30.0 as avg_daily_consumption -- Ayı 30 gün varsayıyoruz
        FROM historical_consumption
        GROUP BY item_id, year, month
    )
    SELECT item_id, 
           AVG(avg_daily_consumption) as mean_daily,
           STDDEV(avg_daily_consumption) as std_daily
    FROM MonthlyData
    GROUP BY item_id
    """
    df_hist = run_query(hist_sql)
    
    # 2. Ortalama Bekleme Süresi (Lead Time)
    lead_sql = """
    SELECT item_id, AVG(given_leadtime) as avg_lead_time
    FROM supplier_item
    WHERE activity_status = 'Aktif'
    GROUP BY item_id
    """
    df_lead = run_query(lead_sql)
    
    # 3. Verileri Birleştir ve Hesapla
    if df_hist.empty:
        logger.warning("No historical data for King's Formula.")
        return

    df_merged = df_hist.merge(df_lead, on='item_id', how='left')
    
    # Opsiyonel parametreler
    # Z-Score: Hizmet seviyesi %95 için Z = 1.65 (Standart Norm Değilimi)
    Z_SCORE = 1.65
    
    results = []
    
    for _, row in df_merged.iterrows():
        item_id = row['item_id']
        mean_d = float(row['mean_daily'] or 0)
        std_d = float(row['std_daily'] or 0)
        # Eğer tedarikçisi yoksa (Örn mamül isek), üretim süresi baz alınmalı. 
        # Şu anlık varsayılan 7 gün veriyoruz.
        lead_time = float(row['avg_lead_time']) if not math.isnan(row.get('avg_lead_time', float('nan'))) else 7.0 
        
        # King's Formula (Standard): SS = Z * sqrt(LeadTime) * Std_Delivery
        # Veya Varyasyon: SS = Z * sqrt((LeadTime * Std_Daily^2) + (Mean_Daily^2 * Std_LeadTime^2))
        # Biz burada basit olanı kullanıyoruz. Ek olarak üretimdeki itemler için std_lead time 0 diyoruz.
        
        ss = Z_SCORE * math.sqrt(lead_time) * std_d
        
        # Negatif veya tanımsız sonuçları elemine et
        if math.isnan(ss) or ss < 0:
            ss = 0
            
        results.append((item_id, round(ss, 2), Z_SCORE))
        
    # 4. Veritabanına Yaz
    if results:
        run_command("TRUNCATE TABLE ss_kings_formula")
        insert_sql = "INSERT INTO ss_kings_formula (item_id, result_king, z_score) VALUES (%s, %s, %s)"
        run_command_batch(insert_sql, results)
        logger.info(f"King's Formula calculated for {len(results)} items.")
    else:
        logger.info("No valid data calculated for King's.")
