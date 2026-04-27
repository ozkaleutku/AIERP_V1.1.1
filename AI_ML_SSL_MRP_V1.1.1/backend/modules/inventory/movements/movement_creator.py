from datetime import date
from backend.database.db_helper import run_command
from backend.modules.inventory.movements.tracking_code_generator import get_next_tracking_seq
from backend.logger import get_logger

logger = get_logger(__name__)


def add_stock_movement(item_id, amount, purpose, movement_date, order_id=None, source_location='ANA_DEPO', target_location='ANA_DEPO', status='Tamamlandı'):
    """
    Genel stok hareketi ekler.
    Eğer purpose = 'satın_alma_girişi' ise target_location='ANA_DEPO', source_location=NULL yapılır.
    Eğer purpose = 'üretim_çıkışı' ise source_location='ANA_DEPO', target_location='ÜRETİM' yapılır. vb.
    """
    # 1. Purpose'a göre varsayılan lokasyon ayarları (Güvenlik için)
    if purpose == 'satın_alma_girişi':
        target_location = 'GİRİŞ_KALİTE'
        source_location = None
    elif purpose == 'satış_çıkışı':
        source_location = 'ANA_DEPO'
        target_location = None
    elif purpose == 'üretim_çıkışı': # Depodan üretim sahasına
        source_location = 'ANA_DEPO'
        target_location = 'ÜRETİM'
    elif purpose == 'üretim_girişi': # Üretim sahasından depoya (Mamül girişi veya hammadde iadesi)
        source_location = 'ÜRETİM'
        target_location = 'ANA_DEPO'
    
    # Tracking Code Oluşturma
    tracking_code = None
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
         
         # 3. Eğer hareket 'Tamamlandı' ise aktif stok bakiyesini anında güncelle
         if status == 'Tamamlandı':
             _update_active_inventory(cur, item_id, amount, source_location, target_location)
             
         conn.commit()
         logger.info(f"Stock movement recorded: {item_id}, {amount}, {purpose}, {status}")
         return new_movement_id
         
    except Exception as e:
         conn.rollback()
         raise e
    finally:
         cur.close()
         release_db_connection(conn)

def _update_active_inventory(cur, item_id, amount, source_location, target_location):
     """
     Yardımcı fonksiyon: Hareket tamamlandığında 'active_inventory' tablosunu günceller.
     Sadece ANA_DEPO etkilenir.
     """
     if target_location == 'ANA_DEPO':
         # ANA_DEPO'ya giriş
         cur.execute("""
              INSERT INTO active_inventory (item_id, current_stock, last_updated)
              VALUES (%s, %s, CURRENT_TIMESTAMP)
              ON CONFLICT (item_id) DO UPDATE SET 
                   current_stock = active_inventory.current_stock + EXCLUDED.current_stock,
                   last_updated = CURRENT_TIMESTAMP
         """, (item_id, amount))
         
     if source_location == 'ANA_DEPO':
         # ANA_DEPO'dan çıkış
         cur.execute("""
              INSERT INTO active_inventory (item_id, current_stock, last_updated)
              VALUES (%s, %s, CURRENT_TIMESTAMP)
              ON CONFLICT (item_id) DO UPDATE SET 
                   current_stock = active_inventory.current_stock - EXCLUDED.current_stock,
                   last_updated = CURRENT_TIMESTAMP
         """, (item_id, amount))
         # Not: Excluded value her zaman pozitiftir (amount pozitiftir), - işaretiyle çıkarıyoruz.
