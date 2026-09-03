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
    YENİ MANTIK: Forecast Consumption & Safety Stock Entegrasyonu!
    """
    logger.info("Rebuilding entire simulation from scratch...")
    from datetime import date
    import pandas as pd
    
    # 1. Reset Planned Inventory from Active Inventory
    run_command("TRUNCATE TABLE planned_inventory")
    run_command("""
    INSERT INTO planned_inventory (item_id, planned_stock)
    SELECT item_id, SUM(current_stock) FROM active_inventory
    GROUP BY item_id
    """)
    
    # 1.5. Add pending Purchase Orders to Planned Inventory
    run_command("""
    INSERT INTO planned_inventory (item_id, planned_stock)
    SELECT item_id, SUM(amount) FROM purchase
    WHERE status = 'Bekleniyor'
    GROUP BY item_id
    ON CONFLICT (item_id) DO UPDATE SET 
        planned_stock = planned_inventory.planned_stock + EXCLUDED.planned_stock
    """)
    
    # 1.75. Güvenlik Stoğunu Düş (MRP motoru eksilen güvenlik stoğunu sipariş etmeye çalışsın)
    # Eğer tablo yoksa hata vermemesi için try-except kullanabiliriz ama tablolar mevcut.
    try:
        run_command("""
        INSERT INTO planned_inventory (item_id, planned_stock)
        SELECT item_id, -safety_stock FROM final_safety_stock WHERE safety_stock > 0
        ON CONFLICT (item_id) DO UPDATE SET 
            planned_stock = planned_inventory.planned_stock - EXCLUDED.planned_stock
        """)
        logger.info("Safety stock levels applied to planned inventory.")
    except Exception as e:
        logger.error(f"Error applying safety stock: {e}")
    
    # 2. Simülasyon satın alma önerilerini sıfırla
    run_command("TRUNCATE TABLE purchase_simulation")
    
    # 3. Clear all Effect tracking logs
    run_command("TRUNCATE TABLE order_simulation_effects")
    
    warnings = []
    
    # 4. GERÇEK MÜŞTERİ SİPARİŞLERİ (Real Demand)
    orders_df = run_query("SELECT * FROM customer_orders WHERE status IN ('Bekleniyor', 'Üretimde') ORDER BY expected_delivery_date ASC, id ASC")
    
    if not orders_df.empty:
        for _, order in orders_df.iterrows():
            try:
                 set_current_order_id(order['id'])
                 due_date = order['expected_delivery_date'] or order['order_date']
                 prod_time_override = int(order['production_time_days']) if order['production_time_days'] else None
                 
                 process_demand(order['item_id'], float(order['amount']), due_date, prod_time_override)
            except Exception as e:
                 logger.error(f"Error simulating order {order['id']}: {e}")
                 warnings.append({"order_id": order['id'], "error": str(e)})
            finally:
                 clear_current_order_id()
    
    # 5. TAHMİN TÜKETİMİ (Forecast Consumption)
    try:
        forecast_df = run_query("""
            SELECT item_id, date, amount
            FROM prophet_table_history
            WHERE is_approved = TRUE AND date >= date_trunc('month', CURRENT_DATE)
        """)
        
        if not forecast_df.empty:
            logger.info(f"Processing Forecast Consumption for {len(forecast_df)} forecast records...")
            
            # Gerçek siparişleri aylara göre grupla
            if not orders_df.empty:
                orders_df['month_key'] = pd.to_datetime(orders_df['expected_delivery_date'].fillna(orders_df['order_date'])).dt.to_period('M')
                orders_df['amount_float'] = orders_df['amount'].astype(float)
                real_demand = orders_df.groupby(['item_id', 'month_key'])['amount_float'].sum().reset_index()
            else:
                real_demand = pd.DataFrame(columns=['item_id', 'month_key', 'amount_float'])
                
            for _, f_row in forecast_df.iterrows():
                item_id = f_row['item_id']
                f_date = pd.to_datetime(f_row['date'])
                f_month = f_date.to_period('M')
                f_amount = float(f_row['amount'])
                
                # Bu ay için gerçekleşen siparişi bul
                matched = real_demand[(real_demand['item_id'] == item_id) & (real_demand['month_key'] == f_month)]
                consumed = float(matched['amount_float'].sum()) if not matched.empty else 0.0
                
                remaining_forecast = f_amount - consumed
                
                if remaining_forecast > 0:
                    try:
                        due_date = f_date.date()
                        logger.info(f"Simulating unconsumed forecast for {item_id}: {remaining_forecast} units on {due_date}")
                        set_current_order_id(f"TAHMİN-{f_month}")
                        process_demand(item_id, remaining_forecast, due_date, None)
                    except Exception as e:
                        logger.error(f"Error simulating forecast for {item_id}: {e}")
                    finally:
                        clear_current_order_id()
    except Exception as e:
        logger.error(f"Forecast Consumption Error: {e}")

    # 6. GÜVENLİK STOĞU TAMAMLAMASI (Safety Stock Replenishment)
    # Yukarıdaki işlemler sonrası planned_stock < 0 ise, o ürün güvenlik stoğunun altına düşmüş veya
    # hiç stok olmadan sipariş edilmeye çalışılmış demektir.
    try:
        negative_stock_df = run_query("SELECT item_id, planned_stock FROM planned_inventory WHERE planned_stock < 0")
        if not negative_stock_df.empty:
            logger.info(f"Triggering automatic replenishments for {len(negative_stock_df)} items dropping below safety stock.")
            for _, row in negative_stock_df.iterrows():
                item_id = row['item_id']
                # required_amount'u 0 geçerek `current_planned`ın - değerini tam olarak kapatacak siparişi açtırıyoruz!
                try:
                    set_current_order_id("GÜVENLİK_STOĞU")
                    process_demand(item_id, 0.0, date.today(), None)
                except Exception as e:
                    logger.error(f"Error replenishing safety stock for {item_id}: {e}")
                finally:
                    clear_current_order_id()
    except Exception as e:
        logger.error(f"Safety Stock Replenishment Error: {e}")

    # 7. Check for missing suppliers after all simulation
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
