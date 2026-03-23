from backend.database.db_helper import run_query


def search_stock_movements(item_id=None, purpose=None, order_id=None, limit=None, offset=None):
    """Stok hareketlerini filtreleyerek getirir. Sayfalama desteği mevcut."""
    base_where = " WHERE 1=1"
    params = []

    if item_id:
        base_where += " AND item_id ILIKE %s"
        params.append(f"%{item_id}%")

    if purpose:
        base_where += " AND purpose = %s"
        params.append(purpose)
        
    if order_id:
        base_where += " AND order_id = %s"
        params.append(order_id)

    if limit is not None:
        count_query = "SELECT COUNT(*) as total FROM stock_movement" + base_where
        count_df = run_query(count_query, tuple(params))
        total = int(count_df.iloc[0]['total']) if not count_df.empty else 0

        query = "SELECT * FROM stock_movement" + base_where + " ORDER BY date DESC, id DESC LIMIT %s OFFSET %s"
        params.append(limit)
        params.append(offset or 0)
        df_movements = run_query(query, tuple(params))
        return df_movements, total
    else:
        query = "SELECT * FROM stock_movement" + base_where + " ORDER BY date DESC, id DESC"
        return run_query(query, tuple(params))

