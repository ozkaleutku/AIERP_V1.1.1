from backend.database.db_helper import run_query


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

def get_final_safety_stock(from_date):
    """Özet tabloyu çeker"""
    sql = """
    SELECT f.item_id, f.date, f.safety_stock, f.item_quantity_type
    FROM final_safety_stock f
    WHERE f.date >= %s
    ORDER BY f.date, f.item_id
    """
    return run_query(sql, (from_date,))

def get_safety_stock_detail(item_id):
    """
    Returns safety stock predictions, historical consumption, AND past AI recommendations.
    """
    # 1. Predictions
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
    
    # Deduplicate
    if not df_pred.empty:
        df_pred = df_pred.sort_values(['date', 'is_approved'], ascending=[True, False])
        df_pred = df_pred.drop_duplicates(subset=['date'], keep='first')
        df_pred['date'] = df_pred['date'].astype(str)
    
    # 2. Historical Requirement
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
        "predictions": df_pred.fillna("").to_dict(orient="records"),
        "sales_history": df_sales.fillna("").to_dict(orient="records"),
        "ai_history": df_ai_history.fillna("").to_dict(orient="records")
    }
