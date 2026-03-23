from backend.database.db_helper import run_query, run_command
from backend.modules.core.bom.bom_circular_check import check_circular_dependency


def get_all_boms_with_details():
    """Tüm BOM yapısını detaylı (Birim bilgisiyle) getirir."""
    sql = """
    SELECT b.*, i.item_quantity_type as child_quantity_type
    FROM bom b
    LEFT JOIN item i ON b.child_id = i.item_id
    ORDER BY b.parent_id, b.child_id
    """
    return run_query(sql)

def add_bom_component(parent_id, child_id, amount, status='Aktif'):
    """Ürün reçetesine bileşen ekler."""
    query = """
    INSERT INTO bom (parent_id, child_id, amount, activity_status)
    VALUES (%s, %s, %s, %s)
    """
    
    if check_circular_dependency(child_id, parent_id):
        raise ValueError(f"Döngüsel Bağımlılık Hatası: {parent_id}, zaten {child_id}'nin bir alt bileşenidir.")

    params = (parent_id, child_id, amount, status)
    return run_command(query, params)

def search_bom(parent_id=None, child_id=None, status=None):
    """Reçeteleri sorgular."""
    query = "SELECT * FROM bom WHERE 1=1"
    params = []
    
    if parent_id:
        query += " AND parent_id = %s"
        params.append(parent_id)
        
    if child_id:
        query += " AND child_id = %s"
        params.append(child_id)
        
    if status:
        query += " AND activity_status = %s"
        params.append(status)
        
    query += " ORDER BY parent_id, child_id"
    
    return run_query(query, tuple(params))

def update_bom_component(parent_id, child_id, amount=None, status=None):
    """Reçete satırını günceller (Miktar veya Durum)."""
    fields = []
    params = []
    
    if amount is not None:
        fields.append("amount = %s")
        params.append(amount)
        
    if status:
        fields.append("activity_status = %s")
        params.append(status)
        
    if not fields:
        return False
        
    query = f"UPDATE bom SET {', '.join(fields)} WHERE parent_id = %s AND child_id = %s"
    params.extend([parent_id, child_id])
    
    return run_command(query, tuple(params))

def soft_delete_bom_component(parent_id, child_id):
    """Reçete satırını pasife çeker."""
    return update_bom_component(parent_id, child_id, status='Pasif')

def hard_delete_bom_component(parent_id, child_id):
    """Reçete satırını tamamen siler."""
    query = "DELETE FROM bom WHERE parent_id = %s AND child_id = %s"
    return run_command(query, (parent_id, child_id))
