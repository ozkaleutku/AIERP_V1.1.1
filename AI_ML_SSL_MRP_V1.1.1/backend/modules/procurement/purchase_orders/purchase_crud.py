from backend.database.db_helper import run_query, run_command


def create_purchase_order(item_id, supplier_id, amount, unit_price, expected_coming_date=None, currency="TRY", purchase_date=None, purpose="normal_sipariş"):
    query = """
    INSERT INTO purchase (item_id, supplier_id, amount, unit_price, purchase_date, expected_coming_date, purpose)
    VALUES (%s, %s, %s, %s, COALESCE(%s, CURRENT_DATE), %s, %s)
    """
    params = (item_id, supplier_id, amount, unit_price, purchase_date, expected_coming_date, purpose)
    return run_command(query, params)

def search_purchase_orders(item_id=None, supplier_id=None, status=None, limit=None, offset=None):
    base_where = " WHERE 1=1"
    params = []
    
    if item_id:
        base_where += " AND item_id ILIKE %s"
        params.append(f"%{item_id}%")
        
    if supplier_id:
        base_where += " AND supplier_id ILIKE %s"
        params.append(f"%{supplier_id}%")
        
    if status:
        base_where += " AND status = %s"
        params.append(status)
        
    if limit is not None:
         count_query = "SELECT COUNT(*) as total FROM purchase" + base_where
         count_df = run_query(count_query, tuple(params))
         total = int(count_df.iloc[0]['total']) if not count_df.empty else 0
         
         query = "SELECT * FROM purchase" + base_where + " ORDER BY purchase_date DESC, id DESC LIMIT %s OFFSET %s"
         params.append(limit)
         params.append(offset or 0)
         
         df = run_query(query, tuple(params))
         return df, total
    else:
         query = "SELECT * FROM purchase" + base_where + " ORDER BY purchase_date DESC, id DESC"
         return run_query(query, tuple(params))

def update_purchase_order_details(purchase_id, supplier_id=None, amount=None, expected_coming_date=None):
    """
    Sipariş bilgilerini (Bekleniyor statüsündeyken) günceller.
    """
    fields = []
    params = []
    
    if supplier_id is not None:
        fields.append("supplier_id = %s")
        params.append(supplier_id)
    if amount is not None:
        fields.append("amount = %s")
        params.append(amount)
    if expected_coming_date is not None:
        fields.append("expected_coming_date = %s")
        params.append(expected_coming_date)
        
    if not fields:
        return False
        
    query = f"UPDATE purchase SET {', '.join(fields)} WHERE id = %s"
    params.append(purchase_id)
    
    return run_command(query, tuple(params))

def delete_purchase_order(purchase_id):
    """Siparişi tamamen siler (Sadece Bekleniyor statüsündekiler silinebilir)."""
    # Önce siparişin durumunu kontrol et
    df = run_query("SELECT status FROM purchase WHERE id = %s", (purchase_id,))
    if df.empty:
        raise ValueError("Sipariş bulunamadı.")
        
    if df.iloc[0]['status'] == "Geldi":
        raise ValueError("Tamamlanmış siparişler silinemez.")
        
    query = "DELETE FROM purchase WHERE id = %s AND status = 'Bekleniyor'"
    return run_command(query, (purchase_id,))

def fetch_order_for_receive(purchase_id):
    df = run_query("SELECT item_id, amount, status FROM purchase WHERE id = %s", (purchase_id,))
    if df.empty:
         raise ValueError("Sipariş bulunamadı.")
    return df.iloc[0]

def update_purchase_order_status(purchase_id, status=None, actual_coming_date=None, unit_price=None, amount=None):
    """Gelme tarihi ve birim fiyat günceller. Status GENERATED olduğu için direkt set edilemez."""
    fields = []
    params = []
    
    if actual_coming_date is not None:
        fields.append("actual_coming_date = %s")
        params.append(actual_coming_date)
    if unit_price is not None:
        fields.append("unit_price = %s")
        params.append(unit_price)
    if amount is not None:
        fields.append("amount = %s")
        params.append(amount)
        
    if not fields:
        return False
        
    query = f"UPDATE purchase SET {', '.join(fields)} WHERE id = %s"
    params.append(purchase_id)
    
    return run_command(query, tuple(params))
