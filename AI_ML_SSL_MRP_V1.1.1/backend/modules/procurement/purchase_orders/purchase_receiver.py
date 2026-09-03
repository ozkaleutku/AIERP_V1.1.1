from datetime import date
from backend.database.db_helper import get_db_connection, release_db_connection
from backend.modules.procurement.purchase_orders.purchase_crud import fetch_order_for_receive
from backend.logger import get_logger

logger = get_logger(__name__)


def receive_purchase_order(purchase_id, actual_coming_date, unit_price=None, received_amount=None):
    """
    Siparişi teslim alır (actual_coming_date set edilince status otomatik 'Geldi' olur)
    ve ilgili stok hareketini oluşturur.
    
    FIX: Hem purchase güncellemesi hem stok hareketi aynı transaction'da yapılır.
    Herhangi birisi başarısız olursa her iki işlem de geri alınır.
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
         
         actual_unit_price = unit_price if unit_price is not None else float(order['unit_price']) if order['unit_price'] else 0
         
         if unit_price is not None:
             fields.append("unit_price = %s")
             params.append(unit_price)
             
         query = f"UPDATE purchase SET {', '.join(fields)} WHERE id = %s"
         params.append(purchase_id)
         cur.execute(query, tuple(params))
         
         # 2.5. Ürünün ana maliyetini güncelle (Hammadde ise alış fiyatı yeni maliyetidir)
         cur.execute("UPDATE item SET unit_cost = %s WHERE item_id = %s", (actual_unit_price, item_id))
         
         # 3. Stok Hareketi Oluştur — AYNI transaction içinde
         from datetime import date as date_mod
         movement_date = actual_coming_date or date_mod.today()
         cur.execute("""
             INSERT INTO stock_movement 
             (item_id, amount, purpose, date, order_id, source_location_id, target_location_id, is_completed)
             VALUES (%s, %s, %s, %s, NULL, NULL, 'GİRİŞ_KALİTE', TRUE)
         """, (item_id, final_amount, 'satın_alma_girişi', movement_date))
         
         # 4. Hepsini birlikte commit et (Atomik işlem)
         conn.commit()
         
         # 5. Detaylı maliyet yayılımını tetikle (Arka planda — commit sonrası)
         try:
             from backend.modules.core.cost_calculation.cost_calculator import recalculate_all_costs
             import threading
             threading.Thread(target=recalculate_all_costs, daemon=True).start()
             logger.info(f"Cost recalculation triggered in background for purchase {purchase_id}")
         except Exception as recalc_err:
             logger.error(f"Error triggering background cost calculation: {recalc_err}")
         
         return True
    except Exception as e:
         conn.rollback()
         raise e
    finally:
         if 'cur' in locals():
             cur.close()
         release_db_connection(conn)
