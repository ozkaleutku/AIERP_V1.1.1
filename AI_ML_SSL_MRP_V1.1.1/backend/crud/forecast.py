from backend.database.db_helper import run_query, run_command

def get_forecast_data():
    """Prophet tahmin verilerini getirir."""
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

def update_forecast_data(item_id, date, amount):
    """Prophet tahmin verisini günceller."""
    sql = """
    UPDATE prophet_table_temporary 
    SET amount = %s, is_approved = FALSE 
    WHERE item_id = %s AND date = %s
    """
    return run_command(sql, (amount, item_id, date))

def approve_forecast(item_id=None, date=None):
    """
    Geçici tahmin verilerini history tablosuna taşır (Onaylama). 
    Filtre verilirse sadece o kaydı onaylar.
    """
    where_clause = ""
    params = []
    
    if item_id and date:
        where_clause = "WHERE item_id = %s AND date = %s"
        params = [item_id, date]
    elif item_id:
        where_clause = "WHERE item_id = %s"
        params = [item_id]

    sql_update = f"UPDATE prophet_table_temporary SET is_approved = TRUE {where_clause}"
    run_command(sql_update, tuple(params) if params else None)

    sql_transfer = f"""
    INSERT INTO prophet_table_history (item_id, date, amount, yhat_lower, yhat_upper)
    SELECT item_id, date, amount, yhat_lower, yhat_upper FROM prophet_table_temporary
    {where_clause}
    ON CONFLICT (item_id, date) DO UPDATE SET amount = EXCLUDED.amount,
        yhat_lower = EXCLUDED.yhat_lower, yhat_upper = EXCLUDED.yhat_upper;
    """
    return run_command(sql_transfer, tuple(params) if params else None)
