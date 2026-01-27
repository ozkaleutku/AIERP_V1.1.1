from datetime import date, datetime, timedelta
from backend.database.db_helper import run_query, run_command
from backend.logger import get_logger

logger = get_logger(__name__)

# Thread-local storage for tracking current order context
_current_order_id = None
_missing_suppliers = set()  # Track items without suppliers during process_demand

def set_current_order_id(order_id):
    """
    Sets the current order ID for effect tracking.
    Must be called before process_demand.
    """
    global _current_order_id, _missing_suppliers
    _current_order_id = order_id
    _missing_suppliers = set()  # Reset for new order

def clear_current_order_id():
    """
    Clears the current order ID after processing is complete.
    """
    global _current_order_id
    _current_order_id = None

def get_missing_suppliers():
    """
    Returns the list of items that have no supplier defined.
    Should be called after process_demand completes.
    """
    global _missing_suppliers
    return list(_missing_suppliers)

def check_supplier_exists(item_id):
    """
    Checks if an item has at least one active supplier.
    """
    sql = """
    SELECT 1 FROM supplier_item 
    WHERE item_id = %s AND activity_status = 'Aktif'
    LIMIT 1
    """
    df = run_query(sql, (item_id,))
    return not df.empty

def get_bom(item_id):
    """
    Fetches the children of an item from the BOM table.
    """
    sql = """
    SELECT child_id, amount
    FROM bom
    WHERE parent_id = %s AND activity_status = 'Aktif'
    """
    df = run_query(sql, (item_id,))
    if df.empty:
        return []
    return df.to_dict(orient="records")

def check_sim_stock(item_id):
    """
    Checks current stock in sip_harita_active_inventory.
    """
    sql = "SELECT current_stock FROM sip_harita_active_inventory WHERE item_id = %s"
    df = run_query(sql, (item_id,))
    if df.empty:
        return 0.0
    return float(df.iloc[0]['current_stock'])

def update_sim_stock(item_id, delta, due_date=None):
    """
    Updates stock by delta (positive or negative).
    Also records the effect if there's a current order context.
    
    Args:
        item_id: The item being affected
        delta: Amount to add (positive) or remove (negative)
        due_date: The date by which this item must be available
    """
    # Ensure item exists
    run_command("""
    INSERT INTO sip_harita_active_inventory (item_id, current_stock) VALUES (%s, 0)
    ON CONFLICT (item_id) DO NOTHING
    """, (item_id,))
    
    # Update stock
    run_command("""
    UPDATE sip_harita_active_inventory 
    SET current_stock = current_stock + %s 
    WHERE item_id = %s
    """, (delta, item_id))
    
    # Record the effect for this order (for reversal on delete)
    global _current_order_id
    if _current_order_id is not None:
        run_command("""
        INSERT INTO sim_order_effects (order_id, item_id, amount_changed, due_date)
        VALUES (%s, %s, %s, %s)
        """, (_current_order_id, item_id, delta, due_date))

def reverse_order_effects(order_id):
    """
    Reverses all simulation effects made by a specific order.
    Called when an order is deleted.
    """
    # Get all effects for this order
    df = run_query("""
    SELECT item_id, amount_changed FROM sim_order_effects
    WHERE order_id = %s
    """, (order_id,))
    
    if df.empty:
        return 0
    
    # Reverse each effect (if delta was -50, we add +50 back)
    for _, row in df.iterrows():
        item_id = row['item_id']
        reverse_amount = -float(row['amount_changed'])  # Negate to reverse
        
        run_command("""
        UPDATE sip_harita_active_inventory 
        SET current_stock = current_stock + %s 
        WHERE item_id = %s
        """, (reverse_amount, item_id))
    
    # Delete the effect records (they're also deleted by CASCADE, but explicit is safer)
    run_command("DELETE FROM sim_order_effects WHERE order_id = %s", (order_id,))
    
    return len(df)

def process_demand(item_id, qty, due_date, production_time_days=0, visited=None):
    """
    Recursive function to process demand in the simulation environment.
    
    1. Check if we have stock in Sim Inventory.
    2. Netting: Use available stock.
    3. If deficit -> Explode BOM.
       - If no BOM (Raw Material) -> Leave as deficit (Simulation Inventory will go negative, indicating Purchase Need).
       - If BOM exists -> Recursively process demand for children.
    
    Args:
        visited: Set of item_ids in the current recursion stack (Cycle Detection)
    
    Note: set_current_order_id() must be called before this function
    to enable effect tracking for the order.
    """
    # Cycle Detection
    if visited is None:
        visited = set()
    
    if item_id in visited:
        logger.warning(f"CRITICAL WARNING: Circular BOM dependency detected for item {item_id}. Skipping to prevent infinite loop.")
        return
    
    # Add current item to visited path
    visited.add(item_id)
    
    # Convert due_date to date object if string
    if isinstance(due_date, str):
        due_date_obj = datetime.strptime(due_date, "%Y-%m-%d").date()
    else:
        due_date_obj = due_date
    
    current_stock = check_sim_stock(item_id)
    
    # 1. Consume what we have - pass due_date for tracking
    consume_amount = qty 
    update_sim_stock(item_id, -consume_amount, due_date_obj)
    
    # Check if we went negative (Deficit)
    # If we are negative, it means we need to produce or buy 'deficit_amount'
    # Logic: 
    # If I had 10, needed 15. Stock becomes -5.
    # So I need to replenish 5.
    
    # Netting logic: Only explode the missing part
    if current_stock < qty:
        # Calculate how much we actually need to produce/buy
        if current_stock > 0:
            needed_to_produce = qty - current_stock
        else:
            needed_to_produce = qty
            
        if needed_to_produce > 0:
            bom_items = get_bom(item_id)
            if bom_items:
                # It has a BOM, so we must produce it using children
                # Calculate start date for children - they must be ready BEFORE production starts
                # production_time_days comes from customer order for top-level item
                # For recursive calls (child items), we pass 0 since sub-production is immediate
                
                # Child items must be ready BY production start date
                child_due_date = due_date_obj - timedelta(days=production_time_days)
                
                for child in bom_items:
                    child_qty_needed = needed_to_produce * float(child['amount'])
                    # Pass 0 for production_time_days in recursive calls
                    # because child items don't have their own production time from order
                    process_demand(child['child_id'], child_qty_needed, child_due_date, 0, visited)
            else:
                # No BOM -> It's a Raw Material (or Buy item).
                # Check if this item has a supplier defined
                global _missing_suppliers
                if not check_supplier_exists(item_id):
                    _missing_suppliers.add(item_id)
                # We just leave the stock negative. The "Order Map" page will scan for negative stocks.
    
    # Backtrack: Remove current item from visited path
    visited.remove(item_id)
