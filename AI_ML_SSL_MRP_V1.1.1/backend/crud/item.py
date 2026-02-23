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
        
    query = f"UPDATE item SET {', '.join(fields)} WHERE item_id = %s"
    params.append(item_id)
    
    return run_command(query, tuple(params))

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
