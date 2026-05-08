from datetime import date
from backend.database.db_helper import run_command
from backend.modules.inventory.movements.tracking_code_generator import get_next_tracking_seq
from backend.logger import get_logger

logger = get_logger(__name__)


def add_stock_movement(item_id, amount, purpose, movement_date, order_id=None, source_location='ANA_DEPO', target_location='ANA_DEPO', status='Tamamlandı', tracking_code=None):
    """
    Genel stok hareketi ekler.
    Eğer purpose = 'satın_alma_girişi' ise target_location='ANA_DEPO', source_location=NULL yapılır.
    Eğer purpose = 'üretim_çıkışı' ise source_location='ANA_DEPO', target_location='ÜRETİM' yapılır. vb.
    """
    # 1. Purpose'a göre varsayılan lokasyon ayarları (Eğer boş gönderilmişse)
    if purpose == 'satın_alma_girişi':
        target_location = target_location or 'GİRİŞ_KALİTE'
        source_location = source_location or None
    elif purpose == 'satış_çıkışı':
        source_location = source_location or 'ANA_DEPO'
        target_location = target_location or None
    elif purpose in ('üretim_çıkışı', 'üretime_giden'): # Depodan üretim sahasına
        source_location = source_location or 'ANA_DEPO'
        target_location = target_location or 'ÜRETİM'
    elif purpose in ('üretim_girişi', 'giriş'): # Üretim sahasından depoya (Mamül girişi veya hammadde iadesi)
        source_location = source_location or ('ÜRETİM' if purpose == 'üretim_girişi' else 'GİRİŞ_KALİTE')
        target_location = target_location or 'ANA_DEPO'
    elif purpose == 'iade':
        source_location = source_location or 'ÜRETİM'
        target_location = target_location or 'ANA_DEPO'
    
    # Tracking Code Oluşturma
    if not tracking_code:
        tracking_seq = None
        if order_id:
             tracking_seq = get_next_tracking_seq(order_id, item_id)
             tracking_code = f"S{order_id}-{item_id}-{tracking_seq}"

    is_completed = (status == 'Tamamlandı')
    
    query = """
    INSERT INTO stock_movement 
    (item_id, amount, purpose, date, order_id, source_location_id, target_location_id, is_completed, tracking_code)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    RETURNING id
    """
    params = (item_id, amount, purpose, movement_date, order_id, source_location, target_location, is_completed, tracking_code)
    
    # 2. Hareketi veritabanına ekle
    from backend.database.db_helper import get_db_connection, release_db_connection
    from psycopg2.extras import RealDictCursor
    conn = get_db_connection()
    try:
         cur = conn.cursor(cursor_factory=RealDictCursor)
         cur.execute(query, params)
         new_movement_id = cur.fetchone()['id']
         
         # Veritabanı trigger'ı 'update_active_inventory' (database_setup.py) stokları otomatik günceller.
         # Bu nedenle burada tekrar _update_active_inventory çağırmıyoruz (veya call fail oluyordu eski şema yüzünden).
             
         if order_id:
             cur.execute("SELECT status FROM customer_orders WHERE id = %s", (order_id,))
             order_row = cur.fetchone()
             if order_row and order_row['status'] == 'Bekleniyor':
                 cur.execute("UPDATE customer_orders SET status = 'Üretimde' WHERE id = %s", (order_id,))
                 logger.info(f"Order {order_id} status updated to 'Üretimde' after movement creation.")
             
         conn.commit()
         logger.info(f"Stock movement recorded: {item_id}, {amount}, {purpose}, {status}")
         return new_movement_id
         
    except Exception as e:
         conn.rollback()
         raise e
    finally:
         cur.close()
         release_db_connection(conn)


