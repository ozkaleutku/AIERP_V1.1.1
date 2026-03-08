from backend.database.db_helper import run_query, run_command, run_command_batch
from backend.AI_ML import model_lightgbm as lightgbm
from backend.crud import bom_explosion, historical_consumption
from backend.database import sync_ai_history
from backend.logger import get_logger

logger = get_logger(__name__)

def calculate_safety_stock():
    from datetime import datetime
    logger.info("Safety Stock Calculation Orchestrator Started...")

    # 1. Clean up old approval plans for the target year
    target_year = datetime.now().year + 1
    logger.info(f"Clearing old approval plans for target year: {target_year}")
    run_command("DELETE FROM final_safety_stock WHERE EXTRACT(YEAR FROM date) = %s", (target_year,))

    # 2. Run Historical BOM Explosion (Training Target)
    logger.info(">>> Step 1: Triggering Historical Consumption Explosion...")
    historical_consumption.run_historical_bom_explosion_v2()
    
    # 3. Sync Past AI History (Data Visibility for Demo)
    logger.info(">>> Step 2: Syncing AI History for chart visibility...")
    sync_ai_history.sync_ai_history_from_consumption()

    # 4. Run LightGBM Training & Prediction (Algorithmic Learning)
    logger.info(">>> Step 3: Triggering LightGBM Training & Prediction...")
    lightgbm.run_lightgbm_training()

    # 5. Run BOM Explosion (Predictions)
    logger.info(">>> Step 4: Triggering BOM Explosion for predictions...")
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
    
    # 1. Update/Insert into final_safety_stock
    # Only overwrites matching item_id and date, preserves other records.
    
    # 2. Batch Upsert (ON CONFLICT)
    sql_upsert = """
    INSERT INTO final_safety_stock (item_id, date, safety_stock, item_quantity_type, preference)
    VALUES (%s, %s, %s, %s, %s)
    ON CONFLICT (item_id, date) 
    DO UPDATE SET safety_stock = EXCLUDED.safety_stock, item_quantity_type = EXCLUDED.item_quantity_type, preference = EXCLUDED.preference
    """
    
    batch_data = [
        (item.item_id, item.date, item.amount, item.item_quantity_type, getattr(item, 'preference', 'AI'))
        for item in approval_list
    ]
    
    if batch_data:
        run_command_batch(sql_upsert, batch_data)
        
    return len(batch_data)

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
    """Hesaplanmış geçici AI tablosunu çeker, mükerrer kayıtları birleştirir"""
    sql = """
    SELECT 
        item_id, 
        date, 
        ROUND(SUM(amount)::numeric, 2) as amount, 
        MAX(status) as status, 
        MAX(item_type) as item_type, 
        MAX(item_quantity_type) as item_quantity_type
    FROM calculated_full_ss_ai_temp 
    GROUP BY item_id, date
    ORDER BY date, item_id
    """
    return run_query(sql)

def get_kings_formula_results():
    """King's Formula sonuçlarını çeker"""
    sql = """
    SELECT item_id, MAX(result_king) as formula_result 
    FROM ss_kings_formula 
    GROUP BY item_id
    """
    return run_query(sql)

def get_all_active_safety_stock():
    """Tüm aktif onaylanmış safety stock değerlerini çeker"""
    sql = "SELECT item_id, date::text as active_date, safety_stock as active_safety_stock, preference as active_preference FROM final_safety_stock"
    return run_query(sql)


def get_safety_stock_detail(item_id):
    """
    Returns safety stock predictions, historical consumption, AND past AI recommendations.
    """
    # 1. Predictions — sum across all BOM levels per date
    pred_sql = """
    SELECT date, ROUND(SUM(amount)::numeric, 2) as predicted_ss, 0 as is_approved
    FROM calculated_full_ss_ai_temp
    WHERE item_id = %s
    GROUP BY date
    
    UNION ALL
    
    SELECT date, safety_stock as predicted_ss, 1 as is_approved
    FROM final_safety_stock
    WHERE item_id = %s
    ORDER BY date
    """
    df_pred = run_query(pred_sql, (item_id, item_id))
    
    # Deduplicate: if a date has both AI and Approved, keep the Approved one
    if not df_pred.empty:
        df_pred = df_pred.sort_values(['date', 'is_approved'], ascending=[True, False])
        df_pred = df_pred.drop_duplicates(subset=['date'], keep='first')
    
    # 2. Historical Requirement — FROM THE NEW historical_consumption TABLE
    # This already includes BOM-exploded requirements
    sales_sql = """
    SELECT 
        EXTRACT(YEAR FROM date)::int as year,
        EXTRACT(MONTH FROM date)::int as month,
        SUM(amount) as total_sales
    FROM historical_consumption
    WHERE item_id = %s
    GROUP BY EXTRACT(YEAR FROM date), EXTRACT(MONTH FROM date)
    ORDER BY year, month
    """
    df_sales = run_query(sales_sql, (item_id,))
    
    # 3. Historical AI recommendations (ss_ai_history)
    ai_history_sql = """
    SELECT 
        EXTRACT(YEAR FROM date)::int as year,
        EXTRACT(MONTH FROM date)::int as month,
        SUM(amount) as ai_amount
    FROM ss_ai_history
    WHERE item_id = %s
    GROUP BY EXTRACT(YEAR FROM date), EXTRACT(MONTH FROM date)
    ORDER BY year, month
    """
    try:
        df_ai_history = run_query(ai_history_sql, (item_id,))
    except Exception:
        import pandas as pd
        df_ai_history = pd.DataFrame()
    
    return {
        "predictions": df_pred,
        "sales_history": df_sales,
        "ai_history": df_ai_history
    }
