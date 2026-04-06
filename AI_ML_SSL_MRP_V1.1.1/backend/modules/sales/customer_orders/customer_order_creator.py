from datetime import date
from backend.database.db_helper import get_db_connection, release_db_connection
from psycopg2.extras import RealDictCursor

from backend.modules.inventory.movements.movement_creator import add_stock_movement
from backend.modules.simulation.order_map.demand_processor import process_demand
from backend.modules.simulation.order_map.order_effect_tracker import set_current_order_id, clear_current_order_id
from backend.modules.simulation.order_map.sim_supplier_checker import get_missing_suppliers
from backend.shared.utils.validations import validate_item_for_order
from backend.logger import get_logger

logger = get_logger(__name__)


def create_customer_order(order_data: dict):
    """
    Creates a new customer order and runs BOM simulation.
    Returns: dict with 'order' and 'warnings' (list of items without suppliers)
    """
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    warnings = []
    
    is_valid, error_msg = validate_item_for_order(order_data['item_id'])
    if not is_valid:
        cur.close()
        release_db_connection(conn)
        raise ValueError(error_msg)
    
    try:
        cur.execute("""
            INSERT INTO customer_orders 
            (customer_name, item_id, amount, order_date, expected_delivery_date, production_time_days, delivery_date, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (
            order_data['customer_name'], order_data['item_id'], order_data['amount'], 
            order_data['order_date'], order_data.get('expected_delivery_date'), 
            order_data.get('production_time_days'), order_data.get('delivery_date'), 
            order_data.get('status', 'Bekleniyor')
        ))
        new_order = cur.fetchone()
        conn.commit()
        
        if new_order['status'] == 'Sevk Edildi':
            # Handle Direct Shipment Creation
            try:
                add_stock_movement(
                     new_order['item_id'], 
                     float(new_order['amount']), 
                     'satış_çıkışı', 
                     new_order['delivery_date'] or date.today(),
                     new_order['id']
                 )
            except Exception as e:
                logger.error(f"Error recording shipment movement: {e}")
        else:
             try:
                 # Set order context for effect tracking
                 set_current_order_id(new_order['id'])
                 
                 due_date = new_order.get('expected_delivery_date') or new_order.get('order_date')
                 # Manuel override: sipariş formundan girilen üretim süresi varsa onu ilet
                 prod_time_override = int(new_order['production_time_days']) if new_order.get('production_time_days') else None
                 
                 process_demand(new_order['item_id'], float(new_order['amount']), due_date, prod_time_override)
                 
                 # Collect any items without suppliers
                 missing = get_missing_suppliers()
                 if missing:
                     warnings = [{"item_id": item_id, "type": "missing_supplier"} for item_id in missing]
             except Exception as sim_error:
                 logger.warning(f"Simulation Update Warning: {sim_error}")
             finally:
                 clear_current_order_id()

        return {"order": dict(new_order), "warnings": warnings}
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        release_db_connection(conn)
