import threading
from backend.database.db_helper import run_command

# İşlem gören Order_ID'yi tutmak için thread-local (Global state yerine)
_thread_local = threading.local()

def set_current_order_id(order_id):
    """Mevcut siparişi aktif context'e alır"""
    _thread_local.order_id = order_id

def get_current_order_id():
    """Çalışan simulasyon hangi müşteri siparişi_id'si için gerçekleşiyor?"""
    return getattr(_thread_local, 'order_id', None)

def clear_current_order_id():
    if hasattr(_thread_local, 'order_id'):
        delattr(_thread_local, 'order_id')


def track_sim_effect(item_id, amount, reason=""):
    """
    Belirli bir Müşteri Siparişi bazında (Eğer set_current_order_id çalıştırıldıysa)
    yapılan stok düşümü, planlanan üretim veya satın alma etkisini loglar.
    İleride sipariş iptal edilirse, etkileri geri almak için (reverse) kullanılır.
    """
    order_id = get_current_order_id()
    if not order_id:
        return # Sadece belirli bir sipariş bazında işlem yapılırken track eder
        
    query = """
    INSERT INTO order_simulation_effects (order_id, item_id, amount, effect_type)
    VALUES (%s, %s, %s, %s)
    """
    run_command(query, (order_id, item_id, amount, reason))


def reverse_order_effects(order_id: int):
    """
    Silinen veya değiştirilen bir siparişin simülasyon (stok/üretim/satın alma) etkilerini geri döndürür.
    Bunu planlanan stokları (planned_inventory) artırarak ve satın alma önerilerini iptal ederek yapar.
    """
    from backend.database.db_helper import get_db_connection, release_db_connection
    from psycopg2.extras import RealDictCursor
    conn = get_db_connection()
    
    try:
         cur = conn.cursor(cursor_factory=RealDictCursor)
         
         # 1. Hangi etkiler yaşanmış bul
         cur.execute("SELECT * FROM order_simulation_effects WHERE order_id = %s", (order_id,))
         effects = cur.fetchall()
         
         if not effects:
             return 0
             
         for ef in effects:
             item_id = ef['item_id']
             amount = ef['amount']
             e_type = ef['effect_type']
             
             if e_type == 'Stock_Reserved':
                 # Stock Reserve ettiysek (düşmüşüzdür), şimdi geri ekleyelim
                 cur.execute("""
                     UPDATE planned_inventory 
                     SET planned_stock = planned_stock + %s
                     WHERE item_id = %s
                 """, (amount, item_id))
                 
             elif e_type == 'Production_Planned':
                 # Üretim planlandıysa, bu da alt bileşenlere düşüm yaptı demektir, 
                 # alt bileşenlerin rezervasyonları Stock_Reserved olarak zaten track edilmiştir.
                 # Production'ın kendisi için tablo yok, sadece MRP sonuçları.
                 pass
                 
             elif e_type == 'Purchase_Recommended':
                 # Satın alma önerisi (Henüz Bekleniyor olan orderlar) var mı bul, ve düş.
                 cur.execute("""
                     UPDATE purchase 
                     SET amount = amount - %s 
                     WHERE item_id = %s AND status = 'Bekleniyor' 
                     AND id IN (
                         SELECT id FROM purchase WHERE item_id = %s AND status = 'Bekleniyor' ORDER BY date DESC LIMIT 1
                     )
                 """, (amount, item_id, item_id))
                 
                 # Eğer miktar <= 0 olduysa öneriyi sil
                 cur.execute("DELETE FROM purchase WHERE item_id = %s AND status = 'Bekleniyor' AND amount <= 0", (item_id,))

         # 2. Etkileri kayıt defterinden sil
         cur.execute("DELETE FROM order_simulation_effects WHERE order_id = %s", (order_id,))
         
         conn.commit()
         return len(effects)
    except Exception as e:
         conn.rollback()
         raise e
    finally:
         cur.close()
         release_db_connection(conn)
