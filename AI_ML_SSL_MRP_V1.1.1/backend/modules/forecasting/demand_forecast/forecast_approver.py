from backend.database.db_helper import run_command


def approve_forecast(item_id=None, date=None):
    """
    Geçici tahmin verilerini history tablosuna taşır (Onaylama işlemi). 
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
