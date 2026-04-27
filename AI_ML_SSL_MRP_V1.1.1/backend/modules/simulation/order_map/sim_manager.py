from backend.database.db_helper import run_query, run_command
from backend.modules.simulation.order_map.demand_processor import process_demand
from backend.modules.simulation.order_map.order_effect_tracker import set_current_order_id, clear_current_order_id
from backend.modules.simulation.order_map.sim_supplier_checker import get_missing_suppliers
from backend.logger import get_logger

logger = get_logger(__name__)


def rebuild_simulation_from_scratch():
    """
    Sistemi sıfırlar (planned_inventory = active_inventory) ve bekleyen
    tüm siparişleri baştan sona simüle eder. Ağırdır ancak %100 doğruluk sağlar.
    """
    logger.info("Rebuilding entire simulation from scratch...")
    
    # 1. Reset Planned Inventory from Active Inventory
    run_command("TRUNCATE TABLE planned_inventory")
    run_command("""
    INSERT INTO planned_inventory (item_id, planned_stock)
    SELECT item_id, SUM(current_stock) FROM active_inventory
    GROUP BY item_id
    """)
    
    # 2. Simülasyon satın alma önerilerini sıfırla (gerçek purchase tablosuna DOKUNMAZ)
    run_command("TRUNCATE TABLE purchase_simulation")
    
    # 3. Clear all Effect tracking logs
    run_command("TRUNCATE TABLE order_simulation_effects")
    
    # 4. Get all pending Customer Orders sorted by due date
    orders_df = run_query("SELECT * FROM customer_orders WHERE status IN ('Bekleniyor', 'Üretimde') ORDER BY expected_delivery_date ASC, id ASC")
    
    if orders_df.empty:
        logger.info("No pending orders to simulate.")
        return []
        
    warnings = []
    
    # 5. Process each order
    for _, order in orders_df.iterrows():
        try:
             set_current_order_id(order['id'])
             due_date = order['expected_delivery_date'] or order['order_date']
             # Manuel override: sipariş formundan girilen üretim süresi varsa onu ilet
             prod_time_override = int(order['production_time_days']) if order['production_time_days'] else None
             
             process_demand(order['item_id'], float(order['amount']), due_date, prod_time_override)
        except Exception as e:
             logger.error(f"Error simulating order {order['id']}: {e}")
             warnings.append({"order_id": order['id'], "error": str(e)})
        finally:
             clear_current_order_id()
             
    # 6. Check for missing suppliers after all simulation
    missing = get_missing_suppliers()
    if missing:
         for item in missing:
             warnings.append({"item_id": item, "type": "missing_supplier"})
             
    logger.info("Simulation rebuild complete.")
    return warnings

def get_simulation_results():
    """
    Çalıştırılmış olan simülasyonun sonuçlarını döner:
    - Eksilen Stok Durumu (Planned Inventory, negative items flag)
    - Satın Alma İhtiyaçları (purchase_simulation tablosundan)
    """
    
    # 1. Bekleyen / Sorunlu Stoklar
    stock_df = run_query("""
    SELECT p.item_id, p.planned_stock, i.item_type, i.item_quantity_type
    FROM planned_inventory p
    JOIN item i ON p.item_id = i.item_id
    WHERE p.planned_stock < 0
    ORDER BY p.planned_stock ASC
    """)
    
    # 2. Simülasyon Satınalma İhtiyaçları
    purchases_df = run_query("""
    SELECT ps.item_id, ps.amount, ps.order_date, ps.supplier_id
    FROM purchase_simulation ps
    ORDER BY ps.order_date ASC
    """)
    
    stock_records = stock_df.fillna("").to_dict(orient="records") if not stock_df.empty else []
    
    purchases_records = []
    if not purchases_df.empty:
        purchases_df['order_date'] = purchases_df['order_date'].astype(str)
        purchases_records = purchases_df.fillna("").to_dict(orient="records")
    
    return {
        "stock_warnings": stock_records,
        "purchase_needs": purchases_records
    }


def get_simulation_suggestions():
    """
    Takvim görünümü için sipariş önerilerini döndürür.
    Tablo minimal (id, item_id, supplier_id, amount, order_date),
    leadtime ve item bilgileri join ile alınır.
    """
    import pandas as pd
    
    df = run_query("""
        SELECT 
            ps.item_id,
            ps.amount,
            ps.order_date,
            ps.supplier_id,
            COALESCE(si.given_leadtime, 7) as leadtime,
            i.item_type,
            i.item_quantity_type
        FROM purchase_simulation ps
        LEFT JOIN supplier_item si ON ps.item_id = si.item_id AND ps.supplier_id = si.supplier_id
        LEFT JOIN item i ON ps.item_id = i.item_id
        WHERE ps.order_date >= CURRENT_DATE
        ORDER BY ps.order_date ASC
    """)
    
    if df.empty:
        return []
    
    results = []
    
    for _, row in df.iterrows():
        order_date = row['order_date']
        if pd.isna(order_date):
            continue
            
        if hasattr(order_date, 'date'):
            order_date = order_date.date()
        
        supplier_id = row['supplier_id']
        if pd.isna(supplier_id) or not supplier_id:
            supplier_id = 'Bilinmiyor'
        
        leadtime = int(row['leadtime'] or 7)
        
        item_type = row.get('item_type', '')
        if pd.isna(item_type):
            item_type = ''
            
        quantity_type = row.get('item_quantity_type', '')
        if pd.isna(quantity_type):
            quantity_type = ''
        
        results.append({
            'item_id': row['item_id'],
            'order_date': str(order_date),
            'amount': float(row['amount']),
            'supplier_id': supplier_id,
            'leadtime': leadtime,
            'item_type': item_type,
            'item_quantity_type': quantity_type
        })
    
    return results
