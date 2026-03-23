from backend.database.db_helper import run_query, run_command


def add_supplier_item(item_id, supplier_id, amount, given_leadtime, status='Aktif'):
    """Ürüne tedarikçi ekler."""
    query = """
    INSERT INTO supplier_item (item_id, supplier_id, amount, given_leadtime, activity_status)
    VALUES (%s, %s, %s, %s, %s)
    """
    params = (item_id, supplier_id, amount, given_leadtime, status)
    return run_command(query, params)

def search_supplier_items(item_id=None, supplier_id=None, status=None, limit=None, offset=None):
    """Tedarikçi-Ürün ilişkilerini sorgular. Sayfalama desteği mevcut."""
    base_where = " WHERE 1=1"
    params = []
    
    if item_id:
        base_where += " AND item_id ILIKE %s"
        params.append(f"%{item_id}%")
        
    if supplier_id:
        base_where += " AND supplier_id ILIKE %s"
        params.append(f"%{supplier_id}%")
        
    if status:
        base_where += " AND activity_status = %s"
        params.append(status)
        
    if limit is not None:
         count_query = "SELECT COUNT(*) as total FROM supplier_item" + base_where
         count_df = run_query(count_query, tuple(params))
         total = int(count_df.iloc[0]['total']) if not count_df.empty else 0
         
         query = "SELECT * FROM supplier_item" + base_where + " ORDER BY item_id, supplier_id LIMIT %s OFFSET %s"
         params.append(limit)
         params.append(offset or 0)
         
         df = run_query(query, tuple(params))
         return df, total
    else:
         query = "SELECT * FROM supplier_item" + base_where + " ORDER BY item_id, supplier_id"
         return run_query(query, tuple(params))

def update_supplier_item(item_id, supplier_id, amount=None, given_leadtime=None, calculated=None, status=None):
    """Tedarikçi-Ürün ilişkisini günceller."""
    fields = []
    params = []
    
    if amount is not None:
        fields.append("amount = %s")
        params.append(amount)
        
    if given_leadtime is not None:
        fields.append("given_leadtime = %s")
        params.append(given_leadtime)
        
    if calculated is not None:
        fields.append("calculated = %s")
        params.append(calculated)
        
    if status is not None:
        fields.append("activity_status = %s")
        params.append(status)
        
    if not fields:
        return False
        
    query = f"UPDATE supplier_item SET {', '.join(fields)} WHERE item_id = %s AND supplier_id = %s"
    params.extend([item_id, supplier_id])
    
    return run_command(query, tuple(params))

def soft_delete_supplier_item(item_id, supplier_id):
    """Tedarikçi-Ürün ilişkisini pasife çeker."""
    return update_supplier_item(item_id, supplier_id, status='Pasif')

def hard_delete_supplier_item(item_id, supplier_id):
    """Tedarikçi-Ürün ilişkisini tamamen siler."""
    query = "DELETE FROM supplier_item WHERE item_id = %s AND supplier_id = %s"
    return run_command(query, (item_id, supplier_id))
