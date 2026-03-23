from backend.logger import get_logger
from backend.database.db_helper import run_query, run_command
from backend.modules.simulation.order_map.order_effect_tracker import track_sim_effect
from backend.modules.simulation.order_map.sim_bom_explosion import explode_bom
from datetime import timedelta

logger = get_logger(__name__)


def get_planned_stock(item_id):
    """
    Ürünün mevcut (planned) stoğunu getirir. Kayıt yoksa active_inventory baz alınarak tabloya işlenir.
    """
    df = run_query("SELECT planned_stock FROM planned_inventory WHERE item_id = %s", (item_id,))
    if not df.empty:
        return float(df.iloc[0]['planned_stock'])
        
    # Mevcut db active_inventory
    df_active = run_query("SELECT current_stock FROM active_inventory WHERE item_id = %s", (item_id,))
    stock = float(df_active.iloc[0]['current_stock']) if not df_active.empty else 0.0
    
    # Initialize
    run_command("INSERT INTO planned_inventory (item_id, planned_stock) VALUES (%s, %s)", (item_id, stock))
    return stock

def update_planned_stock(item_id, new_value):
    run_command("UPDATE planned_inventory SET planned_stock = %s WHERE item_id = %s", (new_value, item_id))

def get_item_info(item_id):
    df = run_query("SELECT item_type, item_quantity_type FROM item WHERE item_id = %s", (item_id,))
    return df.iloc[0].to_dict() if not df.empty else None

def create_purchase_recommendation(item_id, amount_needed, due_date):
    """
    Eksilen stok için satın alma önerisi (Bekleyen Purchase) oluşturur.
    Tedarikçisi varsa (leadtime + amount >=), yoksa uyarı bırakılarak default yaratılır.
    """
    # Find supplier
    df_supplier = run_query("SELECT supplier_id, given_leadtime FROM supplier_item WHERE item_id = %s AND activity_status = 'Aktif' ORDER BY given_leadtime ASC LIMIT 1", (item_id,))
    
    supplier_id = None
    leadtime = 7 # Default
    if not df_supplier.empty:
         supplier_id = df_supplier.iloc[0]['supplier_id']
         leadtime = int(df_supplier.iloc[0]['given_leadtime'] or leadtime)
         
    expected_coming_date = None
    if due_date:
        expected_coming_date = due_date - timedelta(days=leadtime)
        
    # Create the purchase requirement (Öneri)
    query = """
    INSERT INTO purchase (item_id, supplier_id, amount, status, expected_coming_date)
    VALUES (%s, %s, %s, 'Bekleniyor', %s)
    """
    run_command(query, (item_id, supplier_id, amount_needed, expected_coming_date))
    
    track_sim_effect(item_id, amount_needed, 'Purchase_Recommended')


def process_demand(item_id, required_amount, due_date, production_time_days=0):
    """
    Asıl Simülasyon Motoru Kalbi.
    Verilen item_id'nin required_amount'u karşılanmaya çalışılır:
    1. Depodan düşülür.
    2. Depo eksiye gidiyorsa, item_type'ına bakılır:
        - Mamül/Yarı mamül ise: Üretim yapılması için Alt BOM'lar patlatılır (Recursive).
        - Hammadde/Ticari Mal ise: Satın alma isteği (Purchase) yaratılır.
    """
    item_info = get_item_info(item_id)
    if not item_info:
        logger.error(f"Simülasyon Hatası: {item_id} bulunamadı.")
        return
        
    item_type = item_info['item_type']
    current_planned = get_planned_stock(item_id)
    
    shortfall = required_amount - current_planned
    
    if shortfall <= 0:
        # Stock covers it totally. Just reduce stock.
        update_planned_stock(item_id, current_planned - required_amount)
        track_sim_effect(item_id, required_amount, 'Stock_Reserved')
    else:
        # Stock cannot cover it. Reduce to 0, generate demand for the rest.
        update_planned_stock(item_id, 0)
        track_sim_effect(item_id, current_planned, 'Stock_Reserved')
        
        needed_to_produce_or_buy = shortfall
        
        if item_type in ('mamül', 'yarı_mamül'):
            # Üretim yapmamız lazım. Alt bileşenleri patlat.
            track_sim_effect(item_id, needed_to_produce_or_buy, 'Production_Planned')
            
            # Üretim başlayacağı tarih
            sub_due_date = due_date
            if due_date and production_time_days:
                 sub_due_date = due_date - timedelta(days=production_time_days)
                 
            # Explode the BOM using our separate BOM engine
            explode_bom(item_id, needed_to_produce_or_buy, sub_due_date)
            
        else:
            # Hammadde veya Ticari Mal, Satın alma yapmamız lazım
            create_purchase_recommendation(item_id, needed_to_produce_or_buy, due_date)
            # Planned stoğu zaten 0 yapmıştık, ama aslında eksi bakiyeyi sisteme yazıp bir gün kapatılacağı güne kadar bekletebiliriz,
            # biz simdilik uyari/öneri mekanizması işletip stoğu eksiye bilerek indiriyoruz:
            update_planned_stock(item_id, -shortfall) # Negative stock so user can see what's missing

