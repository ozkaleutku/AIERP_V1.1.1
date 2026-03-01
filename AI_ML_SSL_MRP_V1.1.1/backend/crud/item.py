from backend.database.db_helper import run_query, run_command
import pandas as pd

def create_item(item_id, item_type, quantity_type, status='Aktif'):
    """
    Yeni bir ürün oluşturur.
    
    Args:
        item_id (str): Ürün kodu (PK)
        item_type (str): 'mamül', 'yarı_mamül', 'hammadde'
        quantity_type (str): 'adet', 'gram', 'litre'
        status (str): 'Aktif' veya 'Pasif'
    """
    query = """
    INSERT INTO item (item_id, item_type, item_quantity_type, activity_status, demand_avg, demand_deviation)
    VALUES (%s, %s, %s, %s, 0, 0)
    """
    params = (item_id, item_type, quantity_type, status)
    return run_command(query, params)

def search_items(item_id=None, item_type=None, status=None, limit=None, offset=None):
    """
    Ürünleri dinamik filtrelerle arar.
    
    Args:
        item_id (str): Ürün kodu (Opsiyonel - pattern match yapılabilir)
        item_type (str): 'mamül', 'hammadde' vb. (Opsiyonel)
        status (str): 'Aktif' / 'Pasif' (Opsiyonel)
        limit (int): Sayfa başına kayıt (Opsiyonel)
        offset (int): Atlanacak kayıt (Opsiyonel)
    
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
        # Get total count first
        count_query = "SELECT COUNT(*) as total FROM item" + base_where
        count_df = run_query(count_query, tuple(params))
        total = int(count_df.iloc[0]['total']) if not count_df.empty else 0
        
        # Get paginated data
        query = "SELECT * FROM item" + base_where + " ORDER BY item_id LIMIT %s OFFSET %s"
        params.append(limit)
        params.append(offset or 0)
        df = run_query(query, tuple(params))
        return df, total
    else:
        query = "SELECT * FROM item" + base_where + " ORDER BY item_id"
        return run_query(query, tuple(params))

def update_item(item_id, item_type=None, quantity_type=None, status=None):
    """
    Ürün özelliklerini günceller.
    Değer gönderilmeyen (None) alanlar güncellenmez.
    """
    # Dinamik Update sorgusu oluşturma
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
        
    if not fields:
        return False
        
    # Check if status is actually changing to trigger cascade
    db_status = None
    if status is not None:
        current_item_df = run_query("SELECT activity_status FROM item WHERE item_id = %s", (item_id,))
        if not current_item_df.empty:
            db_status = current_item_df.iloc[0]['activity_status']
            
    query = f"UPDATE item SET {', '.join(fields)} WHERE item_id = %s"
    params.append(item_id)
    
    result = run_command(query, tuple(params))
    
    # Trigger cascade if status changed
    if status is not None and db_status != status:
        is_active = (status == 'Aktif')
        cascade_bom_status_change(item_id, is_active)
        
    return result

def cascade_bom_status_change(item_id, is_active):
    """
    Cascades activity status changes to the BOM tree.
    If an item becomes passive, its child BOM rows, parent BOM rows, and their cascading BOM rows become passive.
    """
    visited_items = set()
    queue = [item_id]
    affected_rows = set()
    
    while queue:
        curr = queue.pop(0)
        if curr in visited_items:
            continue
        visited_items.add(curr)
        
        # Rows where curr is parent (curr -> X)
        df1 = run_query("SELECT parent_id, child_id FROM bom WHERE parent_id = %s", (curr,))
        if not df1.empty:
            for _, r in df1.iterrows():
                affected_rows.add((r['parent_id'], r['child_id']))
                
        # Rows where curr is child (Y -> curr)
        df2 = run_query("SELECT parent_id, child_id FROM bom WHERE child_id = %s", (curr,))
        if not df2.empty:
            for _, r in df2.iterrows():
                affected_rows.add((r['parent_id'], r['child_id']))
                # Since Y's component is affected, Y itself effectively becomes inactive 
                # as a parent, so its parents must also be affected.
                queue.append(r['parent_id'])
                
    if not affected_rows:
        return
        
    for p, c in affected_rows:
        df_bom = run_query("SELECT deactivated_by_item_ids FROM bom WHERE parent_id = %s AND child_id = %s", (p, c))
        if df_bom.empty:
            continue
            
        current_ids_str = df_bom.iloc[0]['deactivated_by_item_ids']
        current_ids = [x.strip() for x in current_ids_str.split(',')] if current_ids_str else []
        
        if not is_active:
            # Deactivating
            if item_id not in current_ids:
                current_ids.append(item_id)
                new_ids_str = ",".join(current_ids)
                run_command("UPDATE bom SET activity_status = 'Pasif', deactivated_by_item_ids = %s WHERE parent_id = %s AND child_id = %s", 
                            (new_ids_str, p, c))
        else:
            # Activating
            if item_id in current_ids:
                current_ids.remove(item_id)
                new_ids_str = ",".join(current_ids) if current_ids else None
                new_status = 'Aktif' if not new_ids_str else 'Pasif'
                run_command("UPDATE bom SET activity_status = %s, deactivated_by_item_ids = %s WHERE parent_id = %s AND child_id = %s",
                            (new_status, new_ids_str, p, c))

def soft_delete_item(item_id):
    """Ürünü pasife çeker ('Pasif')."""
    return update_item(item_id, status='Pasif')

def hard_delete_item(item_id):
    """
    Ürünü veritabanından tamamen siler.
    DİKKAT: İlişkili tablolarda veri varsa hata alabilirsiniz (FK constraint).
    """
    query = "DELETE FROM item WHERE item_id = %s"
    return run_command(query, (item_id,))
