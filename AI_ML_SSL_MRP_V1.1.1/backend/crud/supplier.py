from backend.database.db_helper import run_query, run_command
import pandas as pd

def add_supplier_item(item_id, supplier_id, given_leadtime, given_leadtime_deviation=0, lot_size=0, min_size=0, max_size=0, calculated=False, status='Aktif'):
    """
    Bir ürüne tedarikçi tanımlar.
    """
    query = """
    INSERT INTO supplier_item 
    (item_id, supplier_id, given_leadtime, given_leadtime_deviation, lot_size, min_size, max_size, calculated, activity_status, calculated_leadtime_avg, calculated_leadtime_deviation)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 0, 0)
    """
    params = (item_id, supplier_id, given_leadtime, given_leadtime_deviation, lot_size, min_size, max_size, calculated, status)
    return run_command(query, params)

def search_supplier_items(item_id=None, supplier_id=None, status=None):
    """
    Tedarikçi-Ürün ilişkilerini dinamik filtrelerle arar.
    İlişkili ürünün birim maliyet ve para birimini de getirir.
    """
    query = """
    SELECT 
        si.*, 
        i.unit_cost, 
        i.unit_price, 
        i.currency
    FROM supplier_item si
    LEFT JOIN item i ON si.item_id = i.item_id
    WHERE 1=1
    """
    params = []
    
    if item_id:
        query += " AND si.item_id = %s"
        params.append(item_id)
        
    if supplier_id:
        query += " AND si.supplier_id = %s"
        params.append(supplier_id)
        
    if status:
        query += " AND si.activity_status = %s"
        params.append(status)
        
    query += " ORDER BY si.item_id, si.supplier_id"
    
    return run_query(query, tuple(params))

def update_supplier_item(item_id, supplier_id, given_leadtime=None, given_leadtime_deviation=None, lot_size=None, min_size=None, max_size=None, calculated=None, status=None):
    """
    Tedarikçi-Ürün ilişkisini günceller.
    """
    fields = []
    params = []
    
    if given_leadtime is not None:
        fields.append("given_leadtime = %s")
        params.append(given_leadtime)
        
    if given_leadtime_deviation is not None:
        fields.append("given_leadtime_deviation = %s")
        params.append(given_leadtime_deviation)

    if lot_size is not None:
        fields.append("lot_size = %s")
        params.append(lot_size)

    if min_size is not None:
        fields.append("min_size = %s")
        params.append(min_size)

    if max_size is not None:
        fields.append("max_size = %s")
        params.append(max_size)
    
    if calculated is not None:
        fields.append("calculated = %s")
        params.append(calculated)
        
    if status:
        fields.append("activity_status = %s")
        params.append(status)
        
    if not fields:
        return False
        
    query = f"UPDATE supplier_item SET {', '.join(fields)} WHERE item_id = %s AND supplier_id = %s"
    params.extend([item_id, supplier_id])
    
    return run_command(query, tuple(params))

def soft_delete_supplier_item(item_id, supplier_id):
    """İlişkiyi pasife çeker."""
    return update_supplier_item(item_id, supplier_id, status='Pasif')
        
def hard_delete_supplier_item(item_id, supplier_id):
    """İlişkiyi veritabanından tamamen siler."""
    query = "DELETE FROM supplier_item WHERE item_id = %s AND supplier_id = %s"
    return run_command(query, (item_id, supplier_id))

def get_missing_suppliers():
    """
    Sistemde kayıtlı ama aktif bir tedarikçisi olmayan ve tedarik edilmesi gereken ürünleri bulur.
    (item_type 'mamül' olmayan ve aktif tedarikçisi bulunmayan ürünler)
    """
    query = """
    SELECT i.item_id 
    FROM item i
    WHERE i.item_type != 'mamül' 
    AND i.activity_status = 'Aktif'
    AND NOT EXISTS (
        SELECT 1 
        FROM supplier_item s 
        WHERE s.item_id = i.item_id 
        AND s.activity_status = 'Aktif'
    )
    """
    df = run_query(query)
    return df['item_id'].tolist() if not df.empty else []
