from datetime import date
from backend.database.db_helper import get_db_connection, release_db_connection
from psycopg2.extras import RealDictCursor

from backend.modules.inventory.movements.movement_creator import add_stock_movement
from backend.modules.simulation.order_map.demand_processor import process_demand
from backend.modules.simulation.order_map.order_effect_tracker import set_current_order_id, clear_current_order_id, reverse_order_effects
from backend.modules.simulation.order_map.sim_supplier_checker import get_missing_suppliers
from backend.logger import get_logger

logger = get_logger(__name__)


def update_customer_order(order_id: int, updates: dict):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    warnings = []
    try:
        cur.execute("SELECT * FROM customer_orders WHERE id = %s", (order_id,))
        current_order = cur.fetchone()
        
        if not current_order:
            return None
            
        if current_order['status'] == 'Sevk Edildi':
            raise ValueError("HATA: 'Sevk Edildi' durumundaki siparişler düzenlenemez! Gerekirse silip yeniden oluşturun.")
            
        fields = []
        values = []
        for doc_key in ['amount', 'expected_delivery_date', 'delivery_date', 'production_time_days', 'status']:
             if doc_key in updates and updates[doc_key] is not None:
                  fields.append(f"{doc_key} = %s")
                  values.append(updates[doc_key])
        
        if not fields:
            return {"order": dict(current_order), "warnings": warnings}

        values.append(order_id)
        query = f"UPDATE customer_orders SET {', '.join(fields)} WHERE id = %s RETURNING *"
        
        if current_order['status'] != 'Sevk Edildi':
            reverse_order_effects(order_id)
            
        cur.execute(query, tuple(values))
        updated_order = cur.fetchone()
        
        new_status = updated_order['status']
        if new_status in ('Sevk Edildi', 'Hazır'):
            cur.execute("DELETE FROM order_material_consumption WHERE order_id = %s", (order_id,))

        if new_status == 'Sevk Edildi':
            if current_order['status'] != 'Sevk Edildi':
                delivery_date = updated_order['delivery_date'] or date.today()
                
                # DB_HELPER'DAN DEGIL YENI METHODDAN EKLENECEK HAREKET
                # Ancak burada ayni transaksiyonda yapmak isterseniz cur kullanarak yapalim (ya da add_stock_movement cagiralim)
                cur.execute(
                    "INSERT INTO stock_movement (item_id, amount, purpose, date, order_id, source_location_id, status) VALUES (%s, %s, %s, %s, %s, 'ANA_DEPO', 'Tamamlandı')",
                    (updated_order['item_id'], float(updated_order['amount']), 'satış_çıkışı', delivery_date, order_id)
                )
                
                # Active inventory guncelle
                cur.execute("""
              INSERT INTO active_inventory (item_id, current_stock, last_updated)
              VALUES (%s, %s, CURRENT_TIMESTAMP)
              ON CONFLICT (item_id) DO UPDATE SET 
                   current_stock = active_inventory.current_stock - EXCLUDED.current_stock,
                   last_updated = CURRENT_TIMESTAMP
                """, (updated_order['item_id'], float(updated_order['amount'])))

            conn.commit()
        else:
            conn.commit()
                
        if new_status in ('Bekleniyor', 'Üretimde'):
            try:
                set_current_order_id(updated_order['id'])
                due_date = updated_order.get('expected_delivery_date') or updated_order.get('order_date')
                # Manuel override: sipariş formundan girilen üretim süresi varsa onu ilet
                prod_time_override = int(updated_order['production_time_days']) if updated_order.get('production_time_days') else None
                process_demand(updated_order['item_id'], float(updated_order['amount']), due_date, prod_time_override)
                
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
