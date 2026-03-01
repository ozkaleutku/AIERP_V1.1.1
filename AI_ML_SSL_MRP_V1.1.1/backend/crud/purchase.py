
from backend.database.db_helper import run_query, run_command
from backend.crud.stock import add_stock_movement

def get_orders():
    """
    Tüm siparişleri (Purchase) detaylarıyla getirir.
    Limit: 100
    """
    sql = """
    SELECT p.*, i.item_quantity_type as unit
    FROM purchase p
    LEFT JOIN item i ON p.item_id = i.item_id
    ORDER BY p.purchase_date DESC, p.id DESC
    LIMIT 100
    """
    return run_query(sql)

def create_order(item_id, supplier_id, amount, purpose, purchase_date, expected_coming_date):
    """
    Yeni bir satın alma siparişi oluşturur.
    """
    from backend.crud.validations import validate_item_for_order
    is_valid, error_msg = validate_item_for_order(item_id)
    if not is_valid:
        raise ValueError(error_msg)
        
    sql = """
    INSERT INTO purchase (item_id, supplier_id, amount, purpose, purchase_date, expected_coming_date)
    VALUES (%s, %s, %s, %s, %s, %s)
    """
    params = (item_id, supplier_id, amount, purpose, purchase_date, expected_coming_date)
    return run_command(sql, params)

def delete_order(order_id):
    """
    Siparişi siler.
    Simülasyon stoğu trigger tarafından otomatik düzeltilir.
    """
    sql = "DELETE FROM purchase WHERE id = %s"
    return run_command(sql, (order_id,))

def receive_order(order_id, actual_coming_date):
    """
    Siparişin geldiğini işaretler (Teslim Alma).
    Status kolonu 'generated always' olduğu için otomatik güncellenir.
    Ayrıca depoya giriş hareketi (stock_movement) oluşturur.
    """
    # 1. Sipariş bilgilerini çek (item_id ve amount için)
    order_df = run_query("SELECT item_id, amount FROM purchase WHERE id = %s", (order_id,))
    if order_df.empty:
        raise ValueError(f"Sipariş bulunamadı: {order_id}")
    
    item_id = order_df.iloc[0]['item_id']
    amount = float(order_df.iloc[0]['amount'])
    
    # 2. Siparişi güncelle
    sql = """
    UPDATE purchase 
    SET actual_coming_date = %s
    WHERE id = %s
    """
    run_command(sql, (actual_coming_date, order_id))
    
    # 3. Depoya giriş hareketi oluştur (trigger active_inventory'yi güncelleyecek)
    add_stock_movement(item_id, amount, 'giriş', actual_coming_date)
    
    return True

def update_order(order_id, item_id=None, supplier_id=None, amount=None, purpose=None, purchase_date=None, expected_coming_date=None):
    """
    Siparişi günceller (Edit).
    """
    fields = []
    params = []
    
    if item_id is not None:
        fields.append("item_id = %s")
        params.append(item_id)
        
    if supplier_id is not None:
        fields.append("supplier_id = %s")
        params.append(supplier_id)
        
    if amount is not None:
        fields.append("amount = %s")
        params.append(amount)
        
    if purpose is not None:
        fields.append("purpose = %s")
        params.append(purpose)
        
    if purchase_date is not None:
        fields.append("purchase_date = %s")
        params.append(purchase_date)
        
    if expected_coming_date is not None:
        fields.append("expected_coming_date = %s")
        params.append(expected_coming_date)
        
    if not fields:
        return False
        
    sql = f"UPDATE purchase SET {', '.join(fields)} WHERE id = %s"
    params.append(order_id)
    
    return run_command(sql, tuple(params))
