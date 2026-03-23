from backend.database.db_helper import run_query


def get_next_tracking_seq(order_id, item_id):
    """
    Belirli bir sipariş ve ürün için bir sonraki tracking sırasını (sequence) bulur.
    Örn: return 1 -> S100-ITM-1
    """
    if not order_id:
        return 1
        
    sql = """
    SELECT tracking_seq 
    FROM stock_movement 
    WHERE order_id = %s AND item_id = %s
    ORDER BY tracking_seq DESC 
    LIMIT 1
    """
    df = run_query(sql, (order_id, item_id))
    
    if df.empty:
        return 1
    else:
        current_seq = df.iloc[0]['tracking_seq']
        if current_seq is None:
            return 1
        return current_seq + 1
