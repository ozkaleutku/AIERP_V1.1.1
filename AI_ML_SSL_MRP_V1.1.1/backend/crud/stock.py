from backend.database.db_helper import run_query, run_command, run_command_returning
import pandas as pd
from datetime import datetime
from backend.simulation.sim_bom_explosion import reverse_order_effects

def get_next_tracking_seq(order_id, item_id):
    """
    Belirli bir sipariş ve ürün için bir sonraki takip sıra numarasını döner.
    Format: SiparişNo-ÜrünAdı-SıraNo
    """
    query = "SELECT count(*) FROM stock_movement WHERE order_id = %s AND item_id = %s AND parent_id IS NULL"
    df = run_query(query, (order_id, item_id))
    count = int(df.iloc[0][0]) if not df.empty else 0
    return count + 1

def add_stock_movement(item_id, amount, purpose, date=None, order_id=None, unit_price=0, 
                       source_location_id=None, target_location_id=None, 
                       tracking_code=None, parent_id=None, is_completed=False):
    """
    Yeni bir stok hareketi ekler.
    
    Args:
        item_id (str): Ürün kodu
        amount (float): Miktar
        purpose (str): 'giriş', 'üretime_giden', 'satış_çıkışı', 'çıkış'
        date (str/date): Tarih
        order_id (int): Sipariş ID
        unit_price (float): Birim fiyat
        source_location_id (str): Kaynak depo
        target_location_id (str): Hedef depo
        tracking_code (str): Takip kodu (SiparişNo-Ürün-Sıra)
        parent_id (int): İade ise ana hareket ID
        is_completed (bool): Tümü kullanıldı mı?
    """
    if date is None:
        date = datetime.now().date()
        
    # Default location mapping if not specified
    if not source_location_id and not target_location_id:
        if purpose == 'giriş':
            target_location_id = 'ANA_DEPO'
        elif purpose == 'üretime_giden':
            source_location_id = 'ANA_DEPO'
            target_location_id = 'ÜRETİM'
        elif purpose == 'satış_çıkışı' or purpose == 'çıkış':
            source_location_id = 'ANA_DEPO'

    # Auto-generate tracking code if order context exists and it's a production movement
    if order_id and not tracking_code and purpose == 'üretime_giden':
        seq = get_next_tracking_seq(order_id, item_id)
        tracking_code = f"{order_id}-{item_id}-{seq}"

    query = """
    INSERT INTO stock_movement (
        item_id, amount, purpose, date, order_id, 
        source_location_id, target_location_id, tracking_code, parent_id, is_completed
    )
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    RETURNING id
    """
    params = (item_id, amount, purpose, date, order_id, 
              source_location_id, target_location_id, tracking_code, parent_id, is_completed)
    res = run_command_returning(query, params)
    
    if not res:
        return False

    # Price handling for sales
    if purpose == 'satış_çıkışı':
        if not unit_price or unit_price == 0:
            item_df = run_query("SELECT unit_price FROM item WHERE item_id = %s", (item_id,))
            if not item_df.empty:
                unit_price = float(item_df.iloc[0]['unit_price']) or 0
        run_command("UPDATE sales_out_history SET unit_price = %s WHERE id = %s", (unit_price, res))
    
    # Consumption tracking for production
    if order_id is not None and ('üretim' in purpose.lower() or 'production' in purpose.lower() or target_location_id == 'ÜRETİM' or source_location_id == 'ÜRETİM'):
        # Net effect on consumption
        net_amount = amount if target_location_id == 'ÜRETİM' else -amount
        consumption_sql = """
        INSERT INTO order_material_consumption (order_id, item_id, amount, date)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (order_id, item_id) 
        DO UPDATE SET amount = order_material_consumption.amount + %s
        """
        run_command(consumption_sql, (order_id, item_id, net_amount, date, net_amount))
        
    # Delivery status
    if order_id is not None and purpose == 'satış_çıkışı':
        check_q = "SELECT status FROM customer_orders WHERE id = %s"
        df_check = run_query(check_q, (order_id,))
        if not df_check.empty and df_check.iloc[0]['status'] != 'Sevk Edildi':
            reverse_order_effects(order_id)
            update_co_sql = "UPDATE customer_orders SET status = 'Sevk Edildi', delivery_date = %s WHERE id = %s"
            run_command(update_co_sql, (date, order_id))
            run_command("DELETE FROM order_material_consumption WHERE order_id = %s", (order_id,))
            
    return res


def mark_movement_completed(movement_id):
    """
    Bir stok hareketini 'Tümü Kullanıldı' (Kapalı) olarak işaretler.
    """
    return run_command("UPDATE stock_movement SET is_completed = TRUE WHERE id = %s", (movement_id,))

def search_stock_movements(item_id=None, purpose=None, start_date=None, end_date=None, 
                           order_id=None, tracking_code=None, limit=100):
    """
    Stok hareketlerini filtreler.
    """
    query = "SELECT * FROM stock_movement WHERE 1=1"
    params = []
    
    if item_id:
        query += " AND item_id = %s"
        params.append(item_id)
        
    if purpose:
        query += " AND purpose = %s"
        params.append(purpose)
        
    if start_date:
        query += " AND date >= %s"
        params.append(start_date)
        
    if end_date:
        query += " AND date <= %s"
        params.append(end_date)
        
    if order_id:
        query += " AND order_id = %s"
        params.append(order_id)

    if tracking_code:
        query += " AND tracking_code = %s"
        params.append(tracking_code)
        
    query += " ORDER BY date DESC, id DESC"
    
    if limit:
         query += " LIMIT %s"
         params.append(limit)
    
    return run_query(query, tuple(params))

def get_current_stock(item_id, location_id=None):
    """
    Bir ürünün anlık stok miktarını getirir.
    location_id verilmezse tüm lokasyonların toplamını döner.
    """
    if location_id:
        query = "SELECT current_stock FROM active_inventory WHERE item_id = %s AND location_id = %s"
        df = run_query(query, (item_id, location_id))
    else:
        query = "SELECT SUM(current_stock) as current_stock FROM active_inventory WHERE item_id = %s"
        df = run_query(query, (item_id,))
    
    if not df.empty and df.iloc[0]['current_stock'] is not None:
        return float(df.iloc[0]['current_stock'])
    return 0.0

def get_inventory_with_details(search=None, limit=None, offset=None):
    """
    Active Inventory tablosunu lokasyon bazlı detaylarıyla getirir.
    """
    base_where = ""
    params = []
    
    if search:
        base_where = " WHERE ai.item_id ILIKE %s OR wl.location_name ILIKE %s"
        params.append(f"%{search}%")
        params.append(f"%{search}%")
    
    if limit is not None:
        count_sql = "SELECT COUNT(*) as total FROM active_inventory ai LEFT JOIN warehouse_location wl ON ai.location_id = wl.location_id" + base_where
        count_df = run_query(count_sql, tuple(params))
        total = int(count_df.iloc[0]['total']) if not count_df.empty else 0
        
        sql = """
        SELECT ai.item_id, ai.location_id, wl.location_name, ai.current_stock as amount, i.item_quantity_type as unit
        FROM active_inventory ai
        LEFT JOIN item i ON ai.item_id = i.item_id
        LEFT JOIN warehouse_location wl ON ai.location_id = wl.location_id
        """ + base_where + " ORDER BY ai.item_id, ai.location_id LIMIT %s OFFSET %s"
        params.append(limit)
        params.append(offset or 0)
        df = run_query(sql, tuple(params))
        return df, total
    else:
        sql = """
        SELECT ai.item_id, ai.location_id, wl.location_name, ai.current_stock as amount, i.item_quantity_type as unit
        FROM active_inventory ai
        LEFT JOIN item i ON ai.item_id = i.item_id
        LEFT JOIN warehouse_location wl ON ai.location_id = wl.location_id
        """ + base_where + " ORDER BY ai.item_id, ai.location_id"
        return run_query(sql, tuple(params))

def update_active_inventory_amount(item_id, location_id, new_amount):
    """
    Belirli bir lokasyondaki stok miktarını manuel günceller.
    """
    sql = "UPDATE active_inventory SET current_stock = %s WHERE item_id = %s AND location_id = %s"
    return run_command(sql, (new_amount, item_id, location_id))

def get_all_sales_records():
    """Tüm satış geçmişi kayıtlarını getirir. Sipariş No ve Müşteri bilgilerini de ekler."""
    sql = """
    SELECT 
        s.id, 
        s.item_id, 
        s.amount, 
        s.unit_price,
        s.date, 
        sm.order_id, 
        co.customer_name
    FROM sales_out_history s
    LEFT JOIN stock_movement sm ON s.id = sm.id
    LEFT JOIN customer_orders co ON sm.order_id = co.id
    ORDER BY s.date DESC, s.id DESC
    """
    return run_query(sql)

def add_sales_record(item_id, amount, date, unit_price=0):
    """
    Manuel satış kaydı ekler.
    """
    return add_stock_movement(item_id, amount, "satış_çıkışı", date, unit_price=unit_price)

def update_sales_record(record_id, item_id=None, amount=None, date=None, unit_price=None):
    """Satış kaydını günceller. item_id değişirse trigger eski ve yeni item'ın demand'ini yeniden hesaplar."""
    fields = []
    params = []
    
    if item_id is not None:
        fields.append("item_id = %s")
        params.append(item_id)
    
    if amount is not None:
        fields.append("amount = %s")
        params.append(amount)
        
    if date:
        fields.append("date = %s")
        params.append(date)
    
    if unit_price is not None:
        fields.append("unit_price = %s")
        params.append(unit_price)
        
    if not fields:
        return False
        
    sql = f"UPDATE sales_out_history SET {', '.join(fields)} WHERE id = %s"
    params.append(record_id)
    
    return run_command(sql, tuple(params))

def delete_sales_record(record_id):
    """Satış kaydını siler."""
    return run_command("DELETE FROM sales_out_history WHERE id = %s", (record_id,))
