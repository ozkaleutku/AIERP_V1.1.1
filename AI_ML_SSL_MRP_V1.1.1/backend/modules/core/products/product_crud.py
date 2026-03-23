from backend.database.db_helper import run_query, run_command


def create_item(item_id, item_type, quantity_type, status='Aktif', unit_cost=0, unit_price=0, additional_cost=0, currency='TRY'):
    """
    Yeni bir ürün oluşturur.
    
    Args:
        item_id (str): Ürün kodu (PK)
        item_type (str): 'mamül', 'yarı_mamül', 'hammadde'
        quantity_type (str): 'adet', 'gram', 'litre'
        status (str): 'Aktif' veya 'Pasif'
        unit_cost (float): Birim maliyet
        unit_price (float): Birim fiyat
        additional_cost (float): Ek maliyet
        currency (str): Para birimi
    """
    query = """
    INSERT INTO item (item_id, item_type, item_quantity_type, activity_status, demand_avg, demand_deviation, unit_cost, unit_price, additional_cost, currency)
    VALUES (%s, %s, %s, %s, 0, 0, %s, %s, %s, %s)
    """
    params = (item_id, item_type, quantity_type, status, unit_cost, unit_price, additional_cost, currency)
    return run_command(query, params)

def search_items(item_id=None, item_type=None, status=None, limit=None, offset=None):
    """
    Ürünleri dinamik filtrelerle arar.
    
    Returns:
        tuple: (DataFrame, total_count) if limit is specified, else DataFrame
    """
    base_where = " WHERE 1=1"
    params = []
    
    if item_id:
        base_where += " AND item_id ILIKE %s"
        params.append(f"%{item_id}%")
        
    if item_type:
        base_where += " AND item_type = %s"
        params.append(item_type)
        
    if status:
        base_where += " AND activity_status = %s"
        params.append(status)
    
    if limit is not None:
        count_query = "SELECT COUNT(*) as total FROM item" + base_where
        count_df = run_query(count_query, tuple(params))
        total = int(count_df.iloc[0]['total']) if not count_df.empty else 0
        
        query = "SELECT * FROM item" + base_where + " ORDER BY item_id LIMIT %s OFFSET %s"
        params.append(limit)
        params.append(offset or 0)
        df = run_query(query, tuple(params))
        return df, total
    else:
        query = "SELECT * FROM item" + base_where + " ORDER BY item_id"
        return run_query(query, tuple(params))

def update_item(item_id, item_type=None, quantity_type=None, status=None, unit_cost=None, unit_price=None, additional_cost=None, currency=None):
    """
    Ürün özelliklerini günceller.
    Değer gönderilmeyen (None) alanlar güncellenmez.
    """
    from backend.modules.core.products.product_status_cascade import cascade_bom_status_change

    fields = []
    params = []
    
    if item_type:
        fields.append("item_type = %s")
        params.append(item_type)
        
    if quantity_type:
        fields.append("item_quantity_type = %s")
        params.append(quantity_type)
        
    if status:
        fields.append("activity_status = %s")
        params.append(status)

    if unit_cost is not None:
        fields.append("unit_cost = %s")
        params.append(unit_cost)

    if unit_price is not None:
        fields.append("unit_price = %s")
        params.append(unit_price)

    if additional_cost is not None:
        fields.append("additional_cost = %s")
        params.append(additional_cost)

    if currency is not None:
        fields.append("currency = %s")
        params.append(currency)
        
    if not fields:
        return False
        
    db_status = None
    if status is not None:
        current_item_df = run_query("SELECT activity_status FROM item WHERE item_id = %s", (item_id,))
        if not current_item_df.empty:
            db_status = current_item_df.iloc[0]['activity_status']
            
    query = f"UPDATE item SET {', '.join(fields)} WHERE item_id = %s"
    params.append(item_id)
    
    result = run_command(query, tuple(params))
    
    if status is not None and db_status != status:
        is_active = (status == 'Aktif')
        cascade_bom_status_change(item_id, is_active)
        
    return result

def soft_delete_item(item_id):
    """Ürünü pasife çeker ('Pasif')."""
    return update_item(item_id, status='Pasif')

def hard_delete_item(item_id):
    """Ürünü veritabanından tamamen siler."""
    query = "DELETE FROM item WHERE item_id = %s"
    return run_command(query, (item_id,))
