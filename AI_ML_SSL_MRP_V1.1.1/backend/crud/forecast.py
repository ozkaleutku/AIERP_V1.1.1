import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

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

def update_forecast_data(item_id, date, amount):
    """Prophet tahmin verisini günceller."""
    sql = """
    UPDATE prophet_table_temporary 
    SET amount = %s 
    WHERE item_id = %s AND date = %s
    """
    return run_command(sql, (amount, item_id, date))
