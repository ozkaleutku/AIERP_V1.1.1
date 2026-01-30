
import sys
import os
import pandas as pd

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database.db_helper import run_query, run_command

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
    sql = """
    INSERT INTO purchase (item_id, supplier_id, amount, purpose, purchase_date, expected_coming_date)
    VALUES (%s, %s, %s, %s, %s, %s)
    """
    params = (item_id, supplier_id, amount, purpose, purchase_date, expected_coming_date)
    return run_command(sql, params)

def delete_order(order_id):
    """
    Siparişi siler. 
    Eğer sipariş henüz teslim alınmadıysa (Yolda ise),
    Simülasyon stoğuna daha önce eklenmiş olan bu miktarı geri düşeriz.
    """
    # 1. Siparişi bul
    orders = run_query("SELECT item_id, amount, actual_coming_date FROM purchase WHERE id = %s", (order_id,))
    
    if not orders.empty:
        order = orders.iloc[0]
        # Eğer henüz gelmemişse (YOLDAYSAN), simülasyon stoğundan düşmeliyiz
        if pd.isna(order['actual_coming_date']) or order['actual_coming_date'] is None:
            # Simülasyon stoğundan düş (Negatif update)
            # NOT: Bu sadece o anlık simülasyon tablosunu düzeltir.
            # Reset atılınca zaten VT'den okuyacağı için sorun kalmaz.
            run_command("""
            UPDATE sip_harita_active_inventory 
            SET current_stock = current_stock - %s 
            WHERE item_id = %s
            """, (float(order['amount']), str(order['item_id'])))
            
    # 2. Sil
    sql = "DELETE FROM purchase WHERE id = %s"
    return run_command(sql, (order_id,))

def receive_order(order_id, actual_coming_date):
    """
    Siparişin geldiğini işaretler (Teslim Alma).
    Status kolonu 'generated always' olduğu için otomatik güncellenir.
    """
    sql = """
    UPDATE purchase 
    SET actual_coming_date = %s
    WHERE id = %s
    """
    return run_command(sql, (actual_coming_date, order_id))

def update_order(order_id, item_id=None, supplier_id=None, amount=None, purpose=None, purchase_date=None, expected_coming_date=None):
    """
    Sarişi günceller (Edit).
    """
    fields = []
    params = []
    
    if item_id:
        fields.append("item_id = %s")
        params.append(item_id)
        
    if supplier_id:
        fields.append("supplier_id = %s")
        params.append(supplier_id)
        
    if amount is not None:
        fields.append("amount = %s")
        params.append(amount)
        
    if purpose:
        fields.append("purpose = %s")
        params.append(purpose)
        
    if purchase_date:
        fields.append("purchase_date = %s")
        params.append(purchase_date)
        
    if expected_coming_date:
        fields.append("expected_coming_date = %s")
        params.append(expected_coming_date)
        
    if not fields:
        return False
        
    sql = f"UPDATE purchase SET {', '.join(fields)} WHERE id = %s"
    params.append(order_id)
    
    return run_command(sql, tuple(params))
