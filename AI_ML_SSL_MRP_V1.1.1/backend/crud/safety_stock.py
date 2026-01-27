import pandas as pd
from backend.database.db_helper import run_query, run_command
from backend.AI_ML import lightgbm
from backend.crud import bom_explosion
from backend.logger import get_logger

logger = get_logger(__name__)

def calculate_safety_stock():
    logger.info("Safety Stock Calculation Orchestrator Started...")

    # 1. Check Year Transition
    # Get calculation year (from Prophet Forecasts which drive the AI model)
    df_prophet_year = run_query("SELECT DISTINCT EXTRACT(YEAR FROM date) as year FROM prophet_table_temporary LIMIT 1")
    
    # Get current temporary data year
    df_temp_year = run_query("SELECT DISTINCT EXTRACT(YEAR FROM date) as year FROM ss_ai_temporary LIMIT 1")

    if not df_prophet_year.empty and not df_temp_year.empty:
        calc_year = df_prophet_year.iloc[0]['year']
        current_data_year = df_temp_year.iloc[0]['year']

        logger.info(f"Calculation Year: {calc_year}, Current Temp Data Year: {current_data_year}")

        if calc_year > current_data_year:
            logger.warning(">>> Year Transition Detected! Moving current temp data to history...")
            move_query = """
            INSERT INTO ss_ai_history (item_id, date, amount)
            SELECT item_id, date, amount FROM ss_ai_temporary
            ON CONFLICT (item_id, date) DO NOTHING
            """
            run_command(move_query)
            logger.info(">>> Data moved to history successfully.")
        else:
            logger.info(">>> Same year or older. Overwriting without history backup.")
    else:
        logger.info(">>> No existing data or no prophet forecast found. Proceeding with fresh calculation.")

    # 2. Run LightGBM Training & Prediction
    # This script will TRUNCATE ss_ai_temporary and fill it with new predictions
    logger.info(">>> Triggering LightGBM...")
    lightgbm.run_lightgbm_training()

    # 3. Run BOM Explosion
    # This script triggers from ss_ai_temporary and fills calculated_full_ss_ai_temp
    logger.info(">>> Triggering BOM Explosion...")
    bom_explosion.run_bom_explosion()

    logger.info("Safety Stock Calculation Full Cycle Completed.")

def approve_safety_stock_plan(approval_list):
    """
    Safety Stock önerilerini 'final_safety_stock' tablosuna işler.
    1. Bugünden itibaren olan eski kayıtları temizler.
    2. Yeni onaylanan değerleri UPSERT (Update/Insert) yapar.
    
    approval_list: List of dicts or objects with (item_id, date, amount, item_quantity_type)
    """
    from datetime import date
    
    # 1. Delete records older/equal today (Future planning)
    today_str = date.today().strftime("%Y-%m-%d")
    run_command("DELETE FROM final_safety_stock WHERE date <= %s", (today_str,))
    
    # 2. Upsert Logic
    sql_check = "SELECT 1 FROM final_safety_stock WHERE item_id = %s AND date = %s"
    sql_update = "UPDATE final_safety_stock SET safety_stock = %s, item_quantity_type = %s WHERE item_id = %s AND date = %s"
    sql_insert = "INSERT INTO final_safety_stock (item_id, date, safety_stock, item_quantity_type) VALUES (%s, %s, %s, %s)"
    
    count = 0
    for item in approval_list:
        # Pydantic model access via dot notation, or dict via get
        # Assuming Pydantic object
        i_id = item.item_id
        d_date = item.date
        amt = item.amount
        qty_type = item.item_quantity_type
        
        exists_df = run_query(sql_check, (i_id, d_date))
        if not exists_df.empty:
            run_command(sql_update, (amt, qty_type, i_id, d_date))
        else:
            run_command(sql_insert, (i_id, d_date, amt, qty_type))
        count += 1
        
    return count

def get_final_safety_stock(from_date):
    """Özet tabloyu çeker"""
    sql = """
    SELECT f.item_id, f.date, f.safety_stock, f.item_quantity_type
    FROM final_safety_stock f
    WHERE f.date >= %s
    ORDER BY f.date, f.item_id
    """
    return run_query(sql, (from_date,))

def get_calculated_safety_stock_temp():
    """Hesaplanmış geçici AI tablosunu çeker"""
    sql = "SELECT * FROM calculated_full_ss_ai_temp ORDER BY date, item_id"
    return run_query(sql)

def get_kings_formula_results():
    """King's Formula sonuçlarını çeker"""
    sql = """
    SELECT item_id, MAX(result_king) as formula_result 
    FROM ss_kings_formula 
    GROUP BY item_id
    """
    return run_query(sql)

