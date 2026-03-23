import threading
from backend.database.db_helper import run_query, run_command
from backend.logger import get_logger

logger = get_logger(__name__)

# Cache for item data to avoid excessive DB queries during recursion
_cache = threading.local()

def _init_cache():
    if not hasattr(_cache, 'items'):
        _cache.items = {}
    if not hasattr(_cache, 'boms'):
        _cache.boms = {}

def get_item_data(item_id):
    _init_cache()
    if item_id not in _cache.items:
        df = run_query("SELECT * FROM item WHERE item_id = %s", (item_id,))
        if df.empty:
            _cache.items[item_id] = None
        else:
            _cache.items[item_id] = df.iloc[0].to_dict()
    return _cache.items[item_id]

def get_bom_children(item_id):
    _init_cache()
    if item_id not in _cache.boms:
        df = run_query("SELECT child_id, amount FROM bom WHERE parent_id = %s AND activity_status = 'Aktif'", (item_id,))
        if df.empty:
            _cache.boms[item_id] = []
        else:
            _cache.boms[item_id] = df.to_dict('records')
    return _cache.boms[item_id]

def calculate_item_cost(item_id, visited=None):
    """
    Recursively calculates the cost of an item.
    Cost = (Sum of active child costs * amounts) + Additional Cost
    If the item has no active children, Cost = Unit Cost (for raw materials).
    """
    if visited is None:
        visited = set()

    if item_id in visited:
        logger.warning(f"Circular dependency detected in cost calculation for item {item_id}")
        return 0

    visited.add(item_id)
    
    item_data = get_item_data(item_id)
    if not item_data:
        visited.remove(item_id)
        return 0

    children = get_bom_children(item_id)
    additional_cost = float(item_data.get('additional_cost') or 0.0)

    if not children: # HADDAMDE veya BOM'u olmayan mamül
        # Hammadde ise direkt kendi birim maliyetini kullan
        # Veya reçetesi eksik mamül ise yine kendi birim maliyetini/ek maliyetini kullan
        base_cost = float(item_data.get('unit_cost') or 0.0)
        total_cost = base_cost + additional_cost
    else: # YARI MAMÜL veya MAMÜL (Reçetesi var)
        child_cost_sum = 0
        for child in children:
            child_id = child['child_id']
            qty = float(child['amount'])
            child_unit_cost = calculate_item_cost(child_id, visited)
            child_cost_sum += (child_unit_cost * qty)
        
        total_cost = child_cost_sum + additional_cost

    visited.remove(item_id)
    
    # Küsürat hatalarını engellemek için yuvarlama
    return round(total_cost, 4)

def recalculate_all_costs():
    """
    Tüm ürünlerin birim maliyetlerini aşağıdan yukarıya doğru (bottom-up)
    yeniden hesaplar ve veritabanını günceller.
    """
    logger.info("Starting global cost recalculation...")
    
    # 1. Clear caches
    _init_cache()
    _cache.items = {}
    _cache.boms = {}
    
    # 2. Get all unique items that are not raw materials (only they need calculated costs)
    # Raw materials retain their manually entered unit_costs
    df_items = run_query("SELECT item_id FROM item WHERE item_type IN ('mamül', 'yarı_mamül')")
    if df_items.empty:
         logger.info("No manufactured items to calculate.")
         return
         
    items_to_update = df_items['item_id'].tolist()
    
    # 3. Calculate new costs
    updates = []
    for item_id in items_to_update:
        new_cost = calculate_item_cost(item_id)
        updates.append((new_cost, item_id))
        
    # 4. Batch update database
    if updates:
        # Instead of generic run_command_batch which takes INSERT ON CONFLICT, we need UPDATE
        from backend.database.db_helper import get_db_connection, release_db_connection
        conn = get_db_connection()
        try:
            cur = conn.cursor()
            from psycopg2.extras import execute_batch
            query = "UPDATE item SET unit_cost = %s WHERE item_id = %s"
            execute_batch(cur, query, updates)
            conn.commit()
            cur.close()
            logger.info(f"Successfully recalculated costs for {len(updates)} items.")
        except Exception as e:
            conn.rollback()
            logger.error(f"Error updating costs: {e}")
        finally:
            release_db_connection(conn)
