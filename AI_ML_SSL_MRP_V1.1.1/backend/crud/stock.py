from backend.database.db_helper import run_query, run_command
import pandas as pd
from datetime import datetime
from backend.simulation.sim_bom_explosion import reverse_order_effects

def add_stock_movement(item_id, amount, purpose, date=None, order_id=None):
    """
    Yeni bir stok hareketi ekler.
    
    Args:
        item_id (str): Ürün kodu
        amount (float): Miktar
        purpose (str): 'giriş', 'üretime_giden', 'satış_çıkışı'
        date (str/date): Tarih (Opsiyonel, boşsa bugün)
        order_id (int): Opsiyonel, eğer üretim için çıkış yapılıyorsa sipariş ID
    """
    if date is None:
        date = datetime.now().date()
        
    query = """
    INSERT INTO stock_movement (item_id, amount, purpose, date, order_id)
    VALUES (%s, %s, %s, %s, %s)
    """
    params = (item_id, amount, purpose, date, order_id)
    run_command(query, params)
    
    # Eğer Sipariş ID belirtilmişse ve üretim çıkışıysa, Tüketim tablosunu güncelle
    if order_id is not None and ('üretim' in purpose.lower() or 'production' in purpose.lower()):
        consumption_sql = """
        INSERT INTO order_material_consumption (order_id, item_id, amount, date)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (order_id, item_id) 
        DO UPDATE SET amount = order_material_consumption.amount + EXCLUDED.amount
        """
        run_command(consumption_sql, (order_id, item_id, amount, date))
        
    # Eğer Sipariş ID belirtilmişse ve satış çıkışıysa (sevk), müşteri siparişini "Sevk Edildi" yap
    if order_id is not None and purpose == 'satış_çıkışı':
        # Önce bu siparişin daha önce 'Sevk Edildi' olup olmadığını kontrol edelim
        check_q = "SELECT status FROM customer_orders WHERE id = %s"
        df_check = run_query(check_q, (order_id,))
        if not df_check.empty and df_check.iloc[0]['status'] != 'Sevk Edildi':
            # Önce simülasyon etkilerini geri al
            reverse_order_effects(order_id)
            
            # Sonra durumu güncelle
            update_co_sql = """
            UPDATE customer_orders 
            SET status = 'Sevk Edildi', delivery_date = %s
            WHERE id = %s
            """
            run_command(update_co_sql, (date, order_id))
            
            # Üretim tüketimlerini temizle (artık bitti)
            run_command("DELETE FROM order_material_consumption WHERE order_id = %s", (order_id,))
            
    return True


def search_stock_movements(item_id=None, purpose=None, start_date=None, end_date=None, order_id=None, limit=100):
    """
    Stok hareketlerini filtreler.
    
    Args:
        item_id (str): Ürün kodu
        purpose (str): Hareket amacı
        start_date (date): Başlangıç tarihi
        end_date (date): Bitiş tarihi
        order_id (int): Sipariş no
        limit (int): Kayıt limiti
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
        
    query += " ORDER BY date DESC, id DESC"
    
    if limit:
         query += " LIMIT %s"
         params.append(limit)
    
    return run_query(query, tuple(params))

def get_current_stock(item_id):
    """
    Bir ürünün anlık stok miktarını (Active Inventory) getirir.
    Bu tablo triggerlar ile otomatik güncellenmektedir.
    """
    query = "SELECT current_stock FROM active_inventory WHERE item_id = %s"
    df = run_query(query, (item_id,))
    
    if not df.empty:
        return df.iloc[0]['current_stock']
    return 0.0

def get_inventory_with_details(search=None, limit=None, offset=None):
    """
    Active Inventory tablosunu detaylarıyla (Birim vs) getirir.
    Opsiyonel: search, limit, offset ile sayfalama destekler.
    """
    base_where = ""
    params = []
    
    if search:
        base_where = " WHERE ai.item_id ILIKE %s"
        params.append(f"%{search}%")
    
    if limit is not None:
        # Get total count first
        count_sql = "SELECT COUNT(*) as total FROM active_inventory ai" + base_where
        count_df = run_query(count_sql, tuple(params))
        total = int(count_df.iloc[0]['total']) if not count_df.empty else 0
        
        # Get paginated data
        sql = """
        SELECT ai.item_id, ai.current_stock as amount, i.item_quantity_type as unit
        FROM active_inventory ai
        LEFT JOIN item i ON ai.item_id = i.item_id
        """ + base_where + " ORDER BY ai.item_id LIMIT %s OFFSET %s"
        params.append(limit)
        params.append(offset or 0)
        df = run_query(sql, tuple(params))
        return df, total
    else:
        sql = """
        SELECT ai.item_id, ai.current_stock as amount, i.item_quantity_type as unit
        FROM active_inventory ai
        LEFT JOIN item i ON ai.item_id = i.item_id
        """ + base_where + " ORDER BY ai.item_id"
        return run_query(sql, tuple(params))

def update_active_inventory_amount(item_id, new_amount):
    """
    Active Inventory miktarını manuel günceller.
    DİKKAT: Sayım düzeltmesi vb için kullanılır.
    """
    sql = "UPDATE active_inventory SET current_stock = %s WHERE item_id = %s"
    return run_command(sql, (new_amount, item_id))

def get_all_sales_records():
    """Tüm satış geçmişi kayıtlarını getirir. Sipariş No ve Müşteri bilgilerini de ekler."""
    sql = """
    SELECT 
        s.id, 
        s.item_id, 
        s.amount, 
        s.date, 
        sm.order_id, 
        co.customer_name
    FROM sales_out_history s
    LEFT JOIN stock_movement sm ON s.id = sm.id
    LEFT JOIN customer_orders co ON sm.order_id = co.id
    ORDER BY s.date DESC, s.id DESC
    """
    return run_query(sql)

def add_sales_record(item_id, amount, date):
    """
    Manuel satış kaydı ekler.
    Bu işlem 'satış_çıkışı' amacı ile stok hareketi oluşturur.
    Veritabanındaki trigger sayesinde:
      1. Stoktan düşülür.
      2. sales_out_history tablosuna otomatik kopyalanır.
    """
    return add_stock_movement(item_id, amount, "satış_çıkışı", date)

def update_sales_record(record_id, item_id=None, amount=None, date=None):
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
        
    if not fields:
        return False
        
    sql = f"UPDATE sales_out_history SET {', '.join(fields)} WHERE id = %s"
    params.append(record_id)
    
    return run_command(sql, tuple(params))

def delete_sales_record(record_id):
    """Satış kaydını siler."""
    return run_command("DELETE FROM sales_out_history WHERE id = %s", (record_id,))
