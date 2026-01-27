from backend.database.db_helper import run_query, run_command
from backend.simulation.sim_bom_explosion import process_demand, set_current_order_id, clear_current_order_id
from datetime import date, datetime, timedelta
import pandas as pd
from backend.logger import get_logger

logger = get_logger(__name__)

def initialize_simulation_table(from_active_inventory=True):
    """
    Resets the simulation inventory and all order effects.
    
    Args:
        from_active_inventory: If True, copies initial stock from active_inventory.
                              If False, just clears everything to 0.
    """
    # 1. Clear simulation effect tracking table
    run_command("TRUNCATE TABLE sim_order_effects")
    
    # 2. Clear simulation inventory table
    run_command("TRUNCATE TABLE sip_harita_active_inventory")
    
    if from_active_inventory:
        # Copy from Active Inventory as starting point
        run_command("""
        INSERT INTO sip_harita_active_inventory (item_id, current_stock)
        SELECT item_id, current_stock FROM active_inventory
        """)
    
    # 3. Replay all active customer orders through BOM explosion
    df_orders = run_query("""
        SELECT id, item_id, amount, expected_delivery_date, order_date, production_time_days
        FROM customer_orders 
        WHERE status IN ('Bekleniyor', 'Üretimde', 'Hazır')
        ORDER BY expected_delivery_date ASC
    """)
    
    if not df_orders.empty:
        for _, order in df_orders.iterrows():
            try:
                set_current_order_id(int(order['id']))
                due_date = order.get('expected_delivery_date') or order.get('order_date')
                prod_time = order.get('production_time_days') or 0
                process_demand(order['item_id'], float(order['amount']), due_date, int(prod_time) if prod_time else 0)
            except Exception as sim_error:
                logger.warning(f"Simulation Replay Warning for order {order['id']}: {sim_error}")
            finally:
                clear_current_order_id()
        
        # Check for missing suppliers discovered during simulation
        from backend.simulation.sim_bom_explosion import get_missing_suppliers
        missing = get_missing_suppliers()
        if missing:
            logger.warning(f"WARNING: The following items have NO SUPPLIER defined: {missing}")
            # We could store this in a 'system_alerts' table if we had one.
        
        logger.info(f"Simulation reset complete. Replayed {len(df_orders)} orders.")
    else:
        logger.info("Simulation reset complete. No active orders to replay.")

def get_simulation_suggestions():
    """
    Scans the sip_harita_active_inventory and final_safety_stock to generate suggestions.
    Returns a list of dicts.
    """
    suggestions = []
    
    # Pre-fetch all supplier leadtimes in one query (performance optimization)
    # Use the user's preference: calculated = true → use calculated_leadtime_avg
    #                           calculated = false/null → use given_leadtime
    sql_all_suppliers = """
    SELECT item_id, supplier_id, 
           CASE 
               WHEN calculated = true THEN COALESCE(calculated_leadtime_avg, given_leadtime)
               ELSE COALESCE(given_leadtime, calculated_leadtime_avg)
           END as leadtime
    FROM supplier_item
    WHERE activity_status = 'Aktif'
    ORDER BY item_id, leadtime ASC
    """
    df_all_suppliers = run_query(sql_all_suppliers)
    
    # Build dictionary: item_id -> (supplier_id, leadtime) for best supplier
    supplier_lookup = {}
    if not df_all_suppliers.empty:
        for item_id in df_all_suppliers['item_id'].unique():
            item_suppliers = df_all_suppliers[df_all_suppliers['item_id'] == item_id]
            if not item_suppliers.empty:
                best = item_suppliers.iloc[0]  # Already sorted by leadtime ASC
                supplier_lookup[item_id] = {
                    'supplier_id': best['supplier_id'],
                    'leadtime': float(best['leadtime'] or 7)
                }
    
    # 1. Scan for Negative Stock (Production/Purchase Need from Customer Orders)
    # --------------------------------------------------------------------------
    # Now we get the earliest due_date from sim_order_effects for each item
    sql_deficits = """
    SELECT 
        s.item_id, 
        s.current_stock, 
        i.item_type,
        (SELECT MIN(e.due_date) 
         FROM sim_order_effects e 
         WHERE e.item_id = s.item_id AND e.due_date IS NOT NULL) as earliest_due_date
    FROM sip_harita_active_inventory s
    JOIN item i ON s.item_id = i.item_id
    WHERE s.current_stock < 0
    """
    df_deficits = run_query(sql_deficits)
    
    if not df_deficits.empty:
        for _, row in df_deficits.iterrows():
            item_id = row['item_id']
            missing_amount = abs(float(row['current_stock']))
            item_type = row['item_type']
            
            # Lookup supplier from pre-fetched data
            supplier_info = supplier_lookup.get(item_id, {'supplier_id': 'Bilinmiyor', 'leadtime': 7})
            supplier_id = supplier_info['supplier_id']
            leadtime = supplier_info['leadtime']
             
            # Get the deadline from the tracked due_date
            # This is when the material MUST be available
            deadline = row.get('earliest_due_date')
            if deadline is None:
                # Fallback: if no due_date was tracked, use today + a reasonable buffer
                deadline = date.today() + timedelta(days=int(leadtime) + 7)
            elif hasattr(deadline, 'date'):
                deadline = deadline.date()
            elif isinstance(deadline, str):
                deadline = datetime.strptime(deadline, "%Y-%m-%d").date()
            
            # Calculate order_date: when to place the order to meet deadline
            order_date = deadline - timedelta(days=int(leadtime))
            
            # Skip if order_date is in the past (don't show past suggestions)
            if order_date < date.today():
                continue
            suggestions.append({
                "item_id": item_id,
                "amount": missing_amount,
                "purpose": "Üretim İçin",
                "supplier_id": supplier_id,
                "order_date": order_date.strftime("%Y-%m-%d"),
                "deadline_date": deadline.strftime("%Y-%m-%d"),
                "leadtime": int(leadtime),
                "status": "Öneri" if supplier_id != 'Bilinmiyor' else "HATA: Tedarikçi Yok"
            })

    # 2. Scan for Safety Stock Violations
    # -----------------------------------
    # Logic: "hangi ayın başındaki emniyet stoğuna ne kadar ihlal ediyorsa"
    # Iterate through final_safety_stock for future dates.
    # Compare with CURRENT Sim Stock (assuming Sim Stock is static projection for now).
    
    current_month_start = date.today().replace(day=1)
    
    sql_ss = """
    SELECT item_id, date, safety_stock
    FROM final_safety_stock
    WHERE date >= %s
    ORDER BY date ASC
    """
    df_ss = run_query(sql_ss, (current_month_start,))
    
    if not df_ss.empty:
        # Pre-fetch sim stocks to avoid N+1 queries
        sim_stocks = {}
        df_sim = run_query("SELECT item_id, current_stock FROM sip_harita_active_inventory")
        if not df_sim.empty:
            for _, r in df_sim.iterrows():
                sim_stocks[r['item_id']] = float(r['current_stock'])
        
        for _, row in df_ss.iterrows():
            item_id = row['item_id']
            ss_target = float(row['safety_stock'])
            ss_date = row['date'] # date object or string? Pandas often converts to timestamp.
            if hasattr(ss_date, 'date'): ss_date = ss_date.date()
            elif isinstance(ss_date, str): ss_date = datetime.strptime(ss_date, "%Y-%m-%d").date()
            
            current_sim_stock = sim_stocks.get(item_id, 0.0)
            
            if current_sim_stock < ss_target:
                diff = ss_target - current_sim_stock
                # Logic: "o kadar sipariş oluşturuyor"
                
                # Lookup supplier from pre-fetched data (reusing supplier_lookup from earlier)
                supplier_info = supplier_lookup.get(item_id, {'supplier_id': 'Bilinmiyor', 'leadtime': 7})
                supplier_id = supplier_info['supplier_id']
                leadtime = supplier_info['leadtime']
                
                # "sipariş tarihini de leadtime kadar geriye giderek söylüyor"
                # Target Date = ss_date (Month Start)
                order_date = ss_date - timedelta(days=int(leadtime))
                
                # Skip if order_date is in the past (don't show past suggestions)
                if order_date < date.today():
                    continue

                suggestions.append({
                    "item_id": item_id,
                    "amount": round(diff, 2),
                    "purpose": "Emniyet Stok",
                    "supplier_id": supplier_id,
                    "order_date": order_date.strftime("%Y-%m-%d"),
                    "deadline_date": ss_date.strftime("%Y-%m-%d"),
                    "leadtime": int(leadtime),
                    "status": "Öneri" if supplier_id != 'Bilinmiyor' else "HATA: Tedarikçi Yok"
                })
                
                # IMPORTANT: Since we 'ordered' to fix SS, should we conceptually increase stock for subsequent months?
                # The prompt says: "varsayımsal olarak depodan silerek devam etmeliyiz" implies sequential logic.
                # But for SS check, usually we check against the 'Projected Available Balance'.
                # Here we are comparing against 'sip_harita_active_inventory' which is a single snapshot value after all orders.
                # If we produce an order for Month 1, Month 2 will effectively have that stock too.
                # So we should update our local 'current_sim_stock' reference to allow carry over?
                # Yes, let's update local dict so we don't double order for Month 2 if Month 1 fixed it.
                sim_stocks[item_id] = current_sim_stock + diff

    return suggestions
