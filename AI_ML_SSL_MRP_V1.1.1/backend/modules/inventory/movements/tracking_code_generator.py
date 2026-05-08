from backend.database.db_helper import run_query


def get_next_tracking_seq(order_id, item_id):
    """
    Belirli bir sipariş ve ürün için bir sonraki tracking sırasını (sequence) bulur.
    Örn: return 1 -> S100-ITM-1
    """
    if not order_id:
        return 1
        
    sql = """
    SELECT COUNT(*) as count
    FROM stock_movement 
    WHERE order_id = %s AND item_id = %s AND tracking_code IS NOT NULL
    """
    df = run_query(sql, (order_id, item_id))
    
    if df.empty:
        return 1
    else:
        current_count = df.iloc[0]['count']
        if current_count is None:
            return 1
        return int(current_count) + 1
