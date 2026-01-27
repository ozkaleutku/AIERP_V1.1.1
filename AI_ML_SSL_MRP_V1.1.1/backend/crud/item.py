import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

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

def search_items(item_id=None, item_type=None, status=None):
    """
    Ürünleri dinamik filtrelerle arar.
    
    Args:
        item_id (str): Ürün kodu (Opsiyonel - pattern match yapılabilir)
        item_type (str): 'mamül', 'hammadde' vb. (Opsiyonel)
        status (str): 'Aktif' / 'Pasif' (Opsiyonel)
    """
    query = "SELECT * FROM item WHERE 1=1"
    params = []
    
    if item_id:
        # ID için tam eşleşme yerine içerir (ILIKE) mantığı daha kullanışlı olabilir
        if '%' in item_id:
            query += " AND item_id ILIKE %s"
        else:
            query += " AND item_id = %s"
        params.append(item_id)
        
    if item_type:
        query += " AND item_type = %s"
        params.append(item_type)
        
    if status:
        query += " AND activity_status = %s"
        params.append(status)
        
    query += " ORDER BY item_id"
    
    return run_query(query, tuple(params))

    if status:
        fields.append("activity_status = %s")
        params.append(status)
        
    if 'min_buffer' in locals() and locals()['min_buffer'] is not None:
         # Note: min_buffer parameter must be passed explicitly to this function
         pass 
         
    # To support min_buffer properly without breaking signature:
    # Actually better to just modify the signature above if we can, 
    # but the instruction is "Add min_buffer to update_item".
    
    # Wait, replace_file_content replaces the whole block.
    # I will rewrite the function with min_buffer argument.
    
def update_item(item_id, item_type=None, quantity_type=None, status=None, min_buffer=None):
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
        
    if min_buffer is not None:
        fields.append("min_buffer = %s")
        params.append(min_buffer)
        
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
