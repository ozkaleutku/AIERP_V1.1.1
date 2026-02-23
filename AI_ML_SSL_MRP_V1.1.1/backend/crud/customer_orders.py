from datetime import date
from pydantic import BaseModel
from typing import Optional, List
import psycopg2
from psycopg2.extras import RealDictCursor
from backend.simulation.sim_bom_explosion import process_demand, set_current_order_id, clear_current_order_id, reverse_order_effects, get_missing_suppliers
from backend.config import DB_CONFIG
from backend.crud.stock import add_stock_movement
from backend.database.db_helper import get_db_connection, release_db_connection
from backend.logger import get_logger

logger = get_logger(__name__)

# Pydantic Models
class CustomerOrderCreate(BaseModel):
    customer_name: str
    item_id: str
    amount: float
    order_date: date
    expected_delivery_date: Optional[date] = None
    production_time_days: Optional[int] = None
    delivery_date: Optional[date] = None
    status: Optional[str] = "Bekleniyor"

class CustomerOrderUpdate(BaseModel):
    id: int
    amount: Optional[float] = None
    expected_delivery_date: Optional[date] = None
    delivery_date: Optional[date] = None
    production_time_days: Optional[int] = None
    status: Optional[str] = None

class CustomerOrderResponse(CustomerOrderCreate):
    id: int

# CRUD Functions
def create_customer_order(order: CustomerOrderCreate):
    """
    Creates a new customer order and runs BOM explosion.
    Returns: dict with 'order' and 'warnings' (list of items without suppliers)
    """
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    warnings = []
    
    try:
        cur.execute("""
            INSERT INTO customer_orders 
            (customer_name, item_id, amount, order_date, expected_delivery_date, production_time_days, delivery_date, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (order.customer_name, order.item_id, order.amount, order.order_date, order.expected_delivery_date, order.production_time_days, order.delivery_date, order.status))
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
                 
                 # "expected_delivery_date" is the final delivery date
                 # "production_time_days" is how long production takes
                 # Child items must be ready BY (expected_delivery_date - production_time_days)
                 due_date = new_order.get('expected_delivery_date') or new_order.get('order_date')
                 prod_time = new_order.get('production_time_days') or 0
                 
                 process_demand(new_order['item_id'], float(new_order['amount']), due_date, prod_time)
                 
                 # Collect any items without suppliers
                 missing = get_missing_suppliers()
                 if missing:
                     warnings = [{"item_id": item_id, "type": "missing_supplier"} for item_id in missing]
             except Exception as sim_error:
                 logger.warning(f"Simulation Update Warning: {sim_error}")
                 # We do NOT rollback the main order for simulation error, just log warning.
             finally:
                 # Always clear order context
                 clear_current_order_id()

        return {"order": dict(new_order), "warnings": warnings}
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        release_db_connection(conn)

def get_customer_orders():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT * FROM customer_orders ORDER BY order_date DESC LIMIT 100")
        orders = cur.fetchall()
        return orders
    finally:
        cur.close()
        release_db_connection(conn)


def update_customer_order(order_id: int, updates: CustomerOrderUpdate):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    warnings = []
    try:
        # 1. Fetch current order to compare status/values
        cur.execute("SELECT * FROM customer_orders WHERE id = %s", (order_id,))
        current_order = cur.fetchone()
        
        if not current_order:
            return None
            
        # --- SAFEGUARD: Prevent editing 'Sevk Edildi' orders ---
        if current_order['status'] == 'Sevk Edildi':
            raise ValueError("HATA: 'Sevk Edildi' durumundaki siparişler düzenlenemez! Gerekirse silip yeniden oluşturun.")
            
        # Build dynamic query
        fields = []
        values = []
        if updates.amount is not None:
            fields.append("amount = %s")
            values.append(updates.amount)
        if updates.expected_delivery_date is not None:
            fields.append("expected_delivery_date = %s")
            values.append(updates.expected_delivery_date)
        if updates.delivery_date is not None:
            fields.append("delivery_date = %s")
            values.append(updates.delivery_date)
        if updates.production_time_days is not None:
            fields.append("production_time_days = %s")
            values.append(updates.production_time_days)
        if updates.status is not None:
            fields.append("status = %s")
            values.append(updates.status)
        
        if not fields:
            return {"order": dict(current_order), "warnings": warnings}

        values.append(order_id)
        query = f"UPDATE customer_orders SET {', '.join(fields)} WHERE id = %s RETURNING *"
        
        # 2. Revert OLD effects before update (except if it was already shipped, then no effects exist)
        if current_order['status'] != 'Sevk Edildi':
            reverse_order_effects(order_id)
            
        # 3. Apply Update
        cur.execute(query, tuple(values))
        updated_order = cur.fetchone()
        
        # 4. Handle Logic based on NEW status
        new_status = updated_order['status']
        
        if new_status in ('Sevk Edildi', 'Hazır'):
            # CLEANUP: Remove consumption records for this order since it's finished/shipped
            cur.execute("DELETE FROM order_material_consumption WHERE order_id = %s", (order_id,))

        if new_status == 'Sevk Edildi':
            # Order Shipped -> Reduced Physical Stock
            if current_order['status'] != 'Sevk Edildi':
                delivery_date = updated_order['delivery_date'] or date.today()
                cur.execute(
                    "INSERT INTO stock_movement (item_id, amount, purpose, date, order_id) VALUES (%s, %s, %s, %s, %s)",
                    (updated_order['item_id'], float(updated_order['amount']), 'satış_çıkışı', delivery_date, order_id)
                )
            conn.commit()
        else:
            conn.commit()
                
        if new_status in ('Bekleniyor', 'Üretimde'):
            # Order is still active -> Re-Simulate with new values
            try:
                set_current_order_id(updated_order['id'])
                due_date = updated_order.get('expected_delivery_date') or updated_order.get('order_date')
                prod_time = updated_order.get('production_time_days') or 0
                process_demand(updated_order['item_id'], float(updated_order['amount']), due_date, int(prod_time) if prod_time else 0)
                
                # Collect any items without suppliers
                missing = get_missing_suppliers()
                if missing:
                    warnings.extend([{"item_id": item_id, "type": "missing_supplier"} for item_id in missing])
            except Exception as sim_error:
                logger.warning(f"Simulation Update Warning during Update: {sim_error}")
                warnings.append({"type": "simulation_error", "message": str(sim_error)})
            finally:
                clear_current_order_id()
                
        return {"order": dict(updated_order), "warnings": warnings}
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        release_db_connection(conn)

def delete_customer_order(order_id: int):
    """
    Deletes a customer order and reverses its simulation effects.
    
    Each order's effects on simulation inventory are tracked in sim_order_effects table.
    When deleted, we reverse those effects to restore the simulation state.
    """
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # 1. First reverse the simulation effects (before deleting order due to FK cascade)
        reversed_count = reverse_order_effects(order_id)
        logger.info(f"Reversed {reversed_count} simulation effects for order {order_id}")
        
        # 2. Delete the order (sim_order_effects will also be deleted via CASCADE)
        cur.execute("DELETE FROM customer_orders WHERE id = %s", (order_id,))
        conn.commit()
        
        logger.info(f"Order {order_id} deleted successfully.")
        
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        release_db_connection(conn)
