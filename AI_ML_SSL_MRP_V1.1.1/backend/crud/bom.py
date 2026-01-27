import sys
import os

# Add backend root to sys.path to allow absolute imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database.db_helper import run_query, run_command
import pandas as pd


def get_all_boms_with_details():
    """
    Tüm BOM yapısını detaylı (Birim bilgisiyle) getirir.
    API için kullanılır.
    """
    sql = """
    SELECT b.*, i.item_quantity_type as child_quantity_type
    FROM bom b
    LEFT JOIN item i ON b.child_id = i.item_id
    ORDER BY b.parent_id, b.child_id
    """
    return run_query(sql)

def add_bom_component(parent_id, child_id, amount, status='Aktif'):
    """
    Ürün reçetesine bileşen ekler.
    
    Args:
        parent_id (str): Ana Ürün (Mamül/Yarı Mamül)
        child_id (str): Bileşen (Hammadde/Yarı Mamül)
        amount (float): Birim kullanım miktarı
        status (str): 'Aktif' veya 'Pasif'
    """
    query = """
    INSERT INTO bom (parent_id, child_id, amount, activity_status)
    VALUES (%s, %s, %s, %s)
    """
    
    # Cycle Check
    if check_circular_dependency(child_id, parent_id):
        raise ValueError(f"Döngüsel Bağımlılık Hatası: {parent_id}, zaten {child_id}'nin bir alt bileşenidir.")

    params = (parent_id, child_id, amount, status)
    return run_command(query, params)

def check_circular_dependency(target_child, current_parent, visited=None):
    """
    Recursively checks if target_child is an ancestor of current_parent.
    If true, adding (current_parent -> target_child) would create a cycle.
    """
    if visited is None:
        visited = set()
    
    # 1. Veritabanından mevcut parent'ın parentlarını bul (Reverse BOM)
    # Yani: "Kim bu current_parent'ı kullanıyor?" değil, "current_parent kimleri kullanıyor?"
    # Circular check: target_child -> ... -> current_parent -> target_child (Cycle)
    # So we need to check if target_child is ALREADY included in current_parent's BOM tree? 
    # NO. 
    # Adding A -> B. 
    # Cycle if B -> ... -> A exists.
    # So we search: Is 'A' present in 'B's children components?
    
    # Correct Logic: 
    # We are adding: Parent(A) -uses-> Child(B).
    # Error if: B uses A (directly or indirectly).
    # So we start searching from B (child_id). Can we reach A (parent_id)?
    
    if target_child == current_parent:
        return True
        
    if visited is None:
        visited = set()
        
    if target_child in visited:
        return False # Already checked this path
    visited.add(target_child)
    
    # Get children of target_child
    # "B nelerden oluşuyor?"
    sql = "SELECT child_id FROM bom WHERE parent_id = %s"
    df = run_query(sql, (target_child,))
    
    if df.empty:
        return False
        
    children = df['child_id'].tolist()
    
    if current_parent in children:
        return True # Found A in B's children
        
    for child in children:
        if check_circular_dependency(child, current_parent, visited):
            return True
            
    return False

def search_bom(parent_id=None, child_id=None, status=None):
    """
    Reçeteleri sorgular.
    
    Kullanım Senaryoları:
    1. Bir ürünün reçetesi (Nelerden oluşur?): search_bom(parent_id='X')
    2. Bir hammadde nerelerde kullanılır? (Used Where?): search_bom(child_id='Y')
    """
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
