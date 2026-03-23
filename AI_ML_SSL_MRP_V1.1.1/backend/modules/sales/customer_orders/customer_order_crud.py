from backend.database.db_helper import get_db_connection, release_db_connection
from psycopg2.extras import RealDictCursor
from backend.modules.simulation.order_map.order_effect_tracker import reverse_order_effects
from backend.logger import get_logger

logger = get_logger(__name__)

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

def delete_customer_order(order_id: int):
    """
    Deletes a customer order and reverses its simulation effects.
    """
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # 1. First reverse the simulation effects (before deleting order due to FK cascade)
        reversed_count = reverse_order_effects(order_id)
        logger.info(f"Reversed {reversed_count} simulation effects for order {order_id}")
        
        # 2. Delete the order
        cur.execute("DELETE FROM customer_orders WHERE id = %s", (order_id,))
        conn.commit()
        
        logger.info(f"Order {order_id} deleted successfully.")
        
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cur.close()
        release_db_connection(conn)
