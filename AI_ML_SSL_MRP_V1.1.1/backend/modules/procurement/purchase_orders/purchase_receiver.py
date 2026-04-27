from datetime import date
from backend.database.db_helper import get_db_connection, release_db_connection
from backend.modules.procurement.purchase_orders.purchase_crud import fetch_order_for_receive
from backend.logger import get_logger

logger = get_logger(__name__)


def receive_purchase_order(purchase_id, actual_coming_date, unit_price=None, received_amount=None):
    """
    Siparişi teslim alır (actual_coming_date set edilince status otomatik 'Geldi' olur)
    ve ilgili stok hareketini oluşturur.
    """
    conn = get_db_connection()
    try:
         cur = conn.cursor()
         
         # 1. Sipariş bilgilerini kontrol et
         order = fetch_order_for_receive(purchase_id)
         
         if order['status'] == 'Geldi':
             return True # Zaten tamamlanmış
             
         item_id = order['item_id']
         # Miktar değişmediyse asıl sipariş edilen miktarı al
         final_amount = float(received_amount) if received_amount is not None else float(order['amount'])
         
         # 2. Siparişi güncelle (status GENERATED: actual_coming_date set edilince otomatik 'Geldi' olur)
         fields = ["actual_coming_date = %s", "amount = %s"]
         params = [actual_coming_date, final_amount]
         
         actual_unit_price = unit_price if unit_price is not None else float(order['unit_price'])
         
         if unit_price is not None:
             fields.append("unit_price = %s")
             params.append(unit_price)
             
         query = f"UPDATE purchase SET {', '.join(fields)} WHERE id = %s"
         params.append(purchase_id)
         cur.execute(query, tuple(params))
         
         # 2.5. Ürünün ana maliyetini güncelle (Hammadde ise alış fiyatı yeni maliyetidir)
         # Bu işlem otomatik olarak 'trigger_log_price_history' tetikleyerek geçmişe kaydeder.
         cur.execute("UPDATE item SET unit_cost = %s WHERE item_id = %s", (actual_unit_price, item_id))
         
         # 3. Stok Hareketi Oluştur (satın_alma_girişi -> target: ANA_DEPO)
         from backend.modules.inventory.movements.movement_creator import add_stock_movement
         
         conn.commit()
         
         # Detaylı maliyet yayılımını tetikle (Tüm yarı mamül ve mamülleri yeniden hesapla)
         try:
             from backend.modules.core.cost_calculation.cost_calculator import recalculate_all_costs
             import threading
             # Arka planda çalıştır ki kullanıcıyı bekletmesin
             threading.Thread(target=recalculate_all_costs).start()
             logger.info(f"Cost recalculation triggered in background for purchase {purchase_id}")
         except Exception as recalc_err:
             logger.error(f"Error triggering background cost calculation: {recalc_err}")
         
         # Since we committed the purchase update, we now add the movement.
         try:
             add_stock_movement(
                 item_id=item_id, 
                 amount=final_amount, 
                 purpose="satın_alma_girişi", 
                 movement_date=actual_coming_date or date.today(),
                 order_id=None
             )
         except Exception as sim_err:
             logger.error(f"Error creating stock movement for purchase {purchase_id}: {sim_err}")
         
         return True
    except Exception as e:
         conn.rollback()
         raise e
    finally:
         if 'cur' in locals():
             cur.close()
         release_db_connection(conn)
