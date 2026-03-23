from backend.database.db_helper import get_db_connection, release_db_connection
from backend.logger import get_logger

logger = get_logger(__name__)


def mark_movement_completed(movement_id: int):
    """
    'Bekliyor' statüsündeki bir hareketi 'Tamamlandı' yapar ve aktif stoğu günceller.
    Ayrıca eğer bu bir müşteri siparişi çıkış hareketi ise ve siparişteki miktar tamamlandıysa
    sipariş durumunu günceller.
    """
    from psycopg2.extras import RealDictCursor
    conn = get_db_connection()
    try:
         cur = conn.cursor(cursor_factory=RealDictCursor)
         
         # 1. Hareketi bul ve kontrol et
         cur.execute("SELECT * FROM stock_movement WHERE id = %s", (movement_id,))
         movement = cur.fetchone()
         
         if not movement:
             raise ValueError("Hareket bulunamadı.")
             
         if movement['status'] == 'Tamamlandı':
             return True # Zaten tamamlanmış
             
         # 2. Hareketi güncelle
         cur.execute("UPDATE stock_movement SET status = 'Tamamlandı' WHERE id = %s", (movement_id,))
         
         # 3. Aktif Stoğu Güncelle (ANA_DEPO için)
         from backend.modules.inventory.movements.movement_creator import _update_active_inventory
         _update_active_inventory(
             cur, 
             movement['item_id'], 
             movement['amount'], 
             movement['source_location_id'], 
             movement['target_location_id']
         )
         
         # 4. Müşteri Siparişi Mantığı (Paketleme/Sevkiyat durumu için)
         if movement['purpose'] == 'üretim_çıkışı' and movement['order_id']:
             order_id = movement['order_id']
             item_id = movement['item_id']
             
             # Toplam sevk edilen/paketlenen miktarı hesapla
             cur.execute("""
                 SELECT SUM(amount) as total_shipped 
                 FROM stock_movement 
                 WHERE order_id = %s AND item_id = %s AND purpose = 'üretim_çıkışı' AND status = 'Tamamlandı'
             """, (order_id, item_id))
             
             total_shipped = cur.fetchone()['total_shipped'] or 0
             
             # Siparişteki asıl miktarı al
             cur.execute("SELECT amount, status FROM customer_orders WHERE id = %s", (order_id,))
             order = cur.fetchone()
             
             if order and float(total_shipped) >= float(order['amount']):
                  if order['status'] != 'Sevk Edildi':
                      cur.execute("UPDATE customer_orders SET status = 'Hazır' WHERE id = %s", (order_id,))
                      
         # 5. Order Material Consumption Mantığı
         if movement['purpose'] == 'üretim_çıkışı' and movement['order_id'] and movement['target_location_id'] == 'ÜRETİM':
              # Order IDsine ait order_material_consumption tablosunu güncelle
              cur.execute("""
                   INSERT INTO order_material_consumption (order_id, item_id, amount)
                   VALUES (%s, %s, %s)
                   ON CONFLICT (order_id, item_id) DO UPDATE 
                   SET amount = order_material_consumption.amount + EXCLUDED.amount
              """, (movement['order_id'], movement['item_id'], movement['amount']))
         
         conn.commit()
         return True
         
    except Exception as e:
         conn.rollback()
         logger.error(f"Error marking movement completed {movement_id}: {e}")
         raise e
    finally:
         cur.close()
         release_db_connection(conn)
