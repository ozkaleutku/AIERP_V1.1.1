from backend.database.db_helper import run_query

def get_forecast_data():
    """Prophet tahmin (temporary) verilerini getirir."""
    sql = """
    SELECT p.*, i.item_quantity_type 
    FROM prophet_table_temporary p
    LEFT JOIN item i ON p.item_id = i.item_id
    ORDER BY p.date
    """
    return run_query(sql)

def get_item_forecast_detail(item_id):
    """
    Bir item için detaylı tahmin verisi döner:
    1. Prophet tahminleri (forecast + confidence bounds)
    2. Satış geçmişi (aylık bazda, her ay için geçmiş yıllardaki satışlar)
    """
    # 1. Prophet Tahminleri (temporary + history)
    forecast_sql = """
    SELECT date, amount as yhat, 
           yhat_lower, yhat_upper
    FROM prophet_table_temporary 
    WHERE item_id = %s
    UNION
    SELECT date, amount as yhat,
           yhat_lower, yhat_upper
    FROM prophet_table_history 
    WHERE item_id = %s
    ORDER BY date
    """
    df_forecast = run_query(forecast_sql, (item_id, item_id))
    
    # 2. Satış Geçmişi (Aylık toplam, yıl ve ay bazında)
    sales_sql = """
    SELECT 
        EXTRACT(YEAR FROM date)::int as year,
        EXTRACT(MONTH FROM date)::int as month,
        SUM(amount) as total_sales
    FROM sales_out_history
    WHERE item_id = %s
    GROUP BY EXTRACT(YEAR FROM date), EXTRACT(MONTH FROM date)
    ORDER BY year, month
    """
    df_sales = run_query(sales_sql, (item_id,))
    
    return {
        "forecast": df_forecast,
        "sales_history": df_sales
    }
