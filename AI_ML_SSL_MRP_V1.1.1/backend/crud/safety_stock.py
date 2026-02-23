import pandas as pd
from backend.database.db_helper import run_query, run_command, run_command_batch
from backend.AI_ML import lightgbm
from backend.crud import bom_explosion
from backend.logger import get_logger

logger = get_logger(__name__)

def calculate_safety_stock():
    logger.info("Safety Stock Calculation Orchestrator Started...")

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
    
    # 1. Update/Insert into final_safety_stock
    # Only overwrites matching item_id and date, preserves other records.
    
    # 2. Batch Upsert (ON CONFLICT)
    sql_upsert = """
    INSERT INTO final_safety_stock (item_id, date, safety_stock, item_quantity_type)
    VALUES (%s, %s, %s, %s)
    ON CONFLICT (item_id, date) 
    DO UPDATE SET safety_stock = EXCLUDED.safety_stock, item_quantity_type = EXCLUDED.item_quantity_type
    """
    
    batch_data = [
        (item.item_id, item.date, item.amount, item.item_quantity_type)
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
    sql = "SELECT item_id, date::text as active_date, safety_stock as active_safety_stock FROM final_safety_stock"
    return run_query(sql)

