from backend.database.db_helper import run_command


def update_forecast_data(item_id, date, amount):
    """Prophet tahmin (temporary) verisini günceller ('Revize' manuel)."""
    sql = """
    UPDATE prophet_table_temporary 
    SET amount = %s, is_approved = FALSE 
    WHERE item_id = %s AND date = %s
    """
    return run_command(sql, (amount, item_id, date))
