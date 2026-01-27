import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database.db_helper import run_query, run_command
import pandas as pd
from datetime import datetime

def add_stock_movement(item_id, amount, purpose, date=None):
    """
    Yeni bir stok hareketi ekler.
    
    Args:
        item_id (str): Ürün kodu
        amount (float): Miktar
        purpose (str): 'giriş', 'üretime_giden', 'satış_çıkışı'
        date (str/date): Tarih (Opsiyonel, boşsa bugün)
    """
    if date is None:
        date = datetime.now().date()
        
    query = """
    INSERT INTO stock_movement (item_id, amount, purpose, date)
    VALUES (%s, %s, %s, %s)
    """
    params = (item_id, amount, purpose, date)
    return run_command(query, params)


def search_stock_movements(item_id=None, purpose=None, start_date=None, end_date=None, limit=100):
    """
    Stok hareketlerini filtreler.
    
    Args:
        item_id (str): Ürün kodu
        purpose (str): Hareket amacı
        start_date (date): Başlangıç tarihi
        end_date (date): Bitiş tarihi
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

def get_inventory_with_details():
    """
    Active Inventory tablosunu detaylarıyla (Birim vs) getirir.
    """
    sql = """
    SELECT ai.item_id, ai.current_stock as amount, i.item_quantity_type as unit
    FROM active_inventory ai
    LEFT JOIN item i ON ai.item_id = i.item_id
    ORDER BY ai.item_id
    """
    return run_query(sql)

def update_active_inventory_amount(item_id, new_amount):
    """
    Active Inventory miktarını manuel günceller.
    DİKKAT: Sayım düzeltmesi vb için kullanılır.
    """
    sql = "UPDATE active_inventory SET current_stock = %s WHERE item_id = %s"
    return run_command(sql, (new_amount, item_id))

def get_all_sales_records():
    """Tüm satış geçmişi kayıtlarını getirir."""
    sql = "SELECT * FROM sales_out_history ORDER BY date DESC, id DESC"
    return run_query(sql)

# --- Sales Operations (Moved from dead sales.py) ---
def add_sales_record(item_id, amount, date):
    """
    Manuel satış kaydı ekler.
    Not: Bu işlem stoktan düşmez, sadece kayıt tutar! 
    Stoktan düşmek için 'stock_movement' kullanılmalıdır.
    """
    sql = "INSERT INTO sales_out_history (item_id, amount, date) VALUES (%s, %s, %s)"
    return run_command(sql, (item_id, amount, date))

def update_sales_record(record_id, amount=None, date=None):
    """Satış kaydını günceller."""
    fields = []
    params = []
    
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
