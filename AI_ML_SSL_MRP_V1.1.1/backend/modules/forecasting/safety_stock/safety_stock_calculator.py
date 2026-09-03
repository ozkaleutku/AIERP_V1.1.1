import math
from backend.database.db_helper import run_query, run_command, run_command_batch
from backend.logger import get_logger

logger = get_logger(__name__)

def run_kings_formula_analysis():
    """
    Sistemdeki tarihsel tüketim (historical_consumption) ve 
    tedarikçi bekleme sürelerini (supplier_item) kullanarak
    King's Formula ile Güvenlik Stoğu (Safety Stock) hesaplar.
    
    Sonuçları safety_stock_plan tablosundaki formula_amount alanına yazar.
    Ayrıca ss_kings_formula tablosundaki mevcut verileri de kullanır.
    """
    logger.info("King's Formula calculation started...")
    
    # 1. Günlük Ortalama Tüketim ve Standart Sapması
    hist_sql = """
    WITH MonthlyData AS (
        SELECT item_id, 
               EXTRACT(YEAR FROM date) as year, 
               EXTRACT(MONTH FROM date) as month,
               SUM(amount) / 30.0 as avg_daily_consumption
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
    
    # Z-Score: Hizmet seviyesi %95 için Z = 1.65
    Z_SCORE = 1.65
    
    results = []
    
    for _, row in df_merged.iterrows():
        item_id = row['item_id']
        mean_d = float(row['mean_daily'] or 0)
        std_d = float(row['std_daily'] or 0)
        lead_time = float(row['avg_lead_time']) if not math.isnan(row.get('avg_lead_time', float('nan'))) else 7.0 
        
        # King's Formula: SS = Z * sqrt(LeadTime) * Std_Daily
        ss = Z_SCORE * math.sqrt(lead_time) * std_d
        
        # Negatif veya tanımsız sonuçları elemine et
        if math.isnan(ss) or ss < 0:
            ss = 0
            
        results.append((item_id, round(ss, 5)))
    
    # 4. Sonuçları safety_stock_plan tablosuna yaz (formula_amount alanına)
    if results:
        from datetime import datetime
        target_year = datetime.now().year + 1
        
        # Her ay için King's Formula sonuçlarını safety_stock_plan'a yaz
        batch_data = []
        for item_id, formula_val in results:
            # Item bilgilerini al
            item_df = run_query("SELECT item_type, item_quantity_type FROM item WHERE item_id = %s", (item_id,))
            if item_df.empty:
                continue
            item_type = item_df.iloc[0]['item_type']
            quantity_type = item_df.iloc[0]['item_quantity_type']
            
            for month in range(1, 13):
                date_str = f"{target_year}-{month:02d}-01"
                batch_data.append((item_id, date_str, formula_val, item_type, quantity_type))
        
        if batch_data:
            insert_sql = """
            INSERT INTO safety_stock_plan (item_id, date, formula_amount, item_type, item_quantity_type)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (item_id, date) DO UPDATE SET formula_amount = EXCLUDED.formula_amount
            """
            run_command_batch(insert_sql, batch_data)
        
        logger.info(f"King's Formula calculated for {len(results)} items, written to safety_stock_plan.")
    else:
        logger.info("No valid data calculated for King's.")
