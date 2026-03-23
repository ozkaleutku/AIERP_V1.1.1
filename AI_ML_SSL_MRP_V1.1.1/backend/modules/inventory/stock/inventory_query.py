from backend.database.db_helper import run_query


def get_current_stock(item_id: str) -> float:
    """Belirli bir ürünün ana depodaki (ANA_DEPO) toplam stoğunu döndürür."""
    df = run_query("SELECT current_stock FROM active_inventory WHERE item_id = %s", (item_id,))
    if df.empty:
        return 0.0
    return float(df.iloc[0]['current_stock'])


def get_inventory_with_details(item_id=None, item_type=None, limit=None, offset=None):
    """
    Envanter durumunu filtreleyerek getirir. Sayfalama desteği mevcut.
    Yalnızca 'Aktif' durumdaki ürünlerin stok bilgilerini getirir.
    """
    base_where = " WHERE i.activity_status = 'Aktif'"
    params = []
    
    if item_id:
        base_where += " AND i.item_id ILIKE %s"
        params.append(f"%{item_id}%")
    if item_type:
        base_where += " AND i.item_type = %s"
        params.append(item_type)

    if limit is not None:
        count_query = "SELECT COUNT(*) as total FROM active_inventory a RIGHT JOIN item i ON a.item_id = i.item_id" + base_where
        count_df = run_query(count_query, tuple(params))
        total = int(count_df.iloc[0]['total']) if not count_df.empty else 0

        query = f"""
        SELECT i.item_id, i.item_type, i.item_quantity_type, i.activity_status, COALESCE(a.current_stock, 0) as current_stock
        FROM active_inventory a
        RIGHT JOIN item i ON a.item_id = i.item_id
        {base_where}
        ORDER BY i.item_id
        LIMIT %s OFFSET %s
        """
        params.append(limit)
        params.append(offset or 0)
        df_inv = run_query(query, tuple(params))
        return df_inv, total
    else:
        query = f"""
        SELECT i.item_id, i.item_type, i.item_quantity_type, i.activity_status, COALESCE(a.current_stock, 0) as current_stock
        FROM active_inventory a
        RIGHT JOIN item i ON a.item_id = i.item_id
        {base_where}
        ORDER BY i.item_id
        """
        return run_query(query, tuple(params))
