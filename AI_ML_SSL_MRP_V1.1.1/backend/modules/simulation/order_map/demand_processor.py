from backend.logger import get_logger
from backend.database.db_helper import run_query, run_command
from backend.modules.simulation.order_map.order_effect_tracker import track_sim_effect
from backend.modules.simulation.order_map.sim_bom_explosion import explode_bom
from datetime import timedelta
import math

logger = get_logger(__name__)

# ============================================================
# GLOBAL SABIT: 1 iş günü = kaç saat
# İleride "Ayarlar" modülünden okunabilir hale getirilecek.
# ============================================================
WORK_HOURS_PER_DAY = 8


def get_planned_stock(item_id):
    """
    Ürünün mevcut (planned) stoğunu getirir. Kayıt yoksa active_inventory baz alınarak tabloya işlenir.
    """
    df = run_query("SELECT planned_stock FROM planned_inventory WHERE item_id = %s", (item_id,))
    if not df.empty:
        return float(df.iloc[0]['planned_stock'])
        
    # Mevcut db active_inventory
    df_active = run_query("SELECT SUM(current_stock) as current_stock FROM active_inventory WHERE item_id = %s", (item_id,))
    stock = float(df_active.iloc[0]['current_stock']) if not df_active.empty and df_active.iloc[0]['current_stock'] is not None else 0.0
    
    # Initialize
    run_command("INSERT INTO planned_inventory (item_id, planned_stock) VALUES (%s, %s)", (item_id, stock))
    return stock

def update_planned_stock(item_id, new_value):
    run_command("UPDATE planned_inventory SET planned_stock = %s WHERE item_id = %s", (new_value, item_id))

def get_item_info(item_id):
    """Item tablosundan tip, birim ve üretim süresi bilgilerini çeker."""
    df = run_query(
        "SELECT item_type, item_quantity_type, production_time_value, production_time_unit FROM item WHERE item_id = %s",
        (item_id,)
    )
    return df.iloc[0].to_dict() if not df.empty else None


def calculate_production_days(item_info, quantity):
    """
    Bir item'ın belirli miktardaki toplam üretim süresini GÜN cinsinden hesaplar.
    
    Formül:
        production_time_per_unit × quantity  (birim: saat veya gün)
        Eğer saat ise → gün'e çevrilir (WORK_HOURS_PER_DAY ile)
    
    Args:
        item_info (dict): item tablosundan gelen bilgiler (production_time_value, production_time_unit)
        quantity (float): Üretilecek adet miktarı
    
    Returns:
        int: Toplam üretim süresi (gün, yukarı yuvarlanmış)
    """
    time_value = float(item_info.get('production_time_value') or 0)
    time_unit = item_info.get('production_time_unit') or 'saat'
    
    if time_value <= 0:
        return 0
    
    total_time = time_value * quantity
    
    if time_unit == 'saat':
        # Saat → Gün çevrimi
        total_days = total_time / WORK_HOURS_PER_DAY
    else:
        # Zaten gün cinsinden
        total_days = total_time
    
    # Yukarı yuvarla (2.1 gün → 3 gün)
    return math.ceil(total_days)


def create_purchase_recommendation(item_id, amount_needed, due_date):
    """
    Eksilen stok için satın alma önerisi (Bekleyen Purchase) oluşturur.
    Tedarikçisi varsa (leadtime + amount >=), yoksa uyarı bırakılarak default yaratılır.
    
    due_date: Hammaddenin en geç elimizde olması gereken tarih.
              Sipariş tarihi = due_date - leadtime olarak hesaplanır.
    """
    # Find supplier
    df_supplier = run_query("SELECT supplier_id, given_leadtime FROM supplier_item WHERE item_id = %s AND activity_status = 'Aktif' ORDER BY given_leadtime ASC LIMIT 1", (item_id,))
    
    supplier_id = None
    leadtime = 7 # Default
    if not df_supplier.empty:
         supplier_id = df_supplier.iloc[0]['supplier_id']
         leadtime = int(df_supplier.iloc[0]['given_leadtime'] or leadtime)
         
    # order_date (sipariş verilmesi gereken tarih) = due_date - leadtime
    order_date = None
    if due_date:
        order_date = due_date - timedelta(days=leadtime)
        
    # Simülasyon tablosuna yaz (gerçek purchase tablosuna DEĞİL)
    query = """
    INSERT INTO purchase_simulation (item_id, supplier_id, amount, order_date)
    VALUES (%s, %s, %s, %s)
    """
    run_command(query, (item_id, supplier_id, amount_needed, order_date))
    
    track_sim_effect(item_id, amount_needed, 'Purchase_Recommended')


def process_demand(item_id, required_amount, due_date, production_time_days_override=None):
    """
    Asıl Simülasyon Motoru Kalbi — Backward Scheduling destekli.
    
    Verilen item_id'nin required_amount'u karşılanmaya çalışılır:
    1. Depodan düşülür.
    2. Depo eksiye gidiyorsa, item_type'ına bakılır:
        - Mamül/Yarı mamül ise: 
            a) Item kartındaki üretim süresini okur
            b) Toplam üretim gününü hesaplar (adet × birim süre)
            c) Alt BOM'ları (due_date - üretim_günü) tarihi ile patlatır
        - Hammadde/Ticari Mal ise: Satın alma isteği (Purchase) yaratılır.
    
    Args:
        item_id: Ürün kodu
        required_amount: Gereken miktar
        due_date: Bu ürünün en geç hazır olması gereken tarih
        production_time_days_override: Sipariş formundan gelen manuel override (varsa item'daki değerin yerine kullanılır)
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
            
            # --- BACKWARD SCHEDULING ---
            # Üretim süresini belirle: override varsa onu kullan, yoksa item kartından hesapla
            if production_time_days_override and production_time_days_override > 0:
                total_production_days = int(production_time_days_override)
                logger.info(f"  [{item_id}] Üretim süresi OVERRIDE: {total_production_days} gün (sipariş formundan)")
            else:
                total_production_days = calculate_production_days(item_info, needed_to_produce_or_buy)
                if total_production_days > 0:
                    logger.info(f"  [{item_id}] Üretim süresi: {needed_to_produce_or_buy} adet × "
                                f"{item_info.get('production_time_value', 0)} {item_info.get('production_time_unit', 'saat')} "
                                f"= {total_production_days} gün")
            
            # Alt bileşenlerin hazır olması gereken tarih = bu ürünün teslim tarihi - üretim süresi
            sub_due_date = due_date
            if due_date and total_production_days > 0:
                 sub_due_date = due_date - timedelta(days=total_production_days)
                 logger.info(f"  [{item_id}] Alt bileşenler en geç {sub_due_date} tarihinde hazır olmalı")
                 
            # Explode the BOM using our separate BOM engine
            explode_bom(item_id, needed_to_produce_or_buy, sub_due_date)
            
        else:
            # Hammadde veya Ticari Mal, Satın alma yapmamız lazım
            create_purchase_recommendation(item_id, needed_to_produce_or_buy, due_date)
            update_planned_stock(item_id, -shortfall) # Negative stock so user can see what's missing
