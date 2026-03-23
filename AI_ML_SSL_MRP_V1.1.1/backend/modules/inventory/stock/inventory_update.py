from backend.database.db_helper import run_command


def update_active_inventory_amount(item_id: str, diff: float):
    """
    active_inventory tablosunu günceller. Kayıt yoksa ekler, varsa miktarı DIFF kadar artırır.
    Not: Bu fonksiyon stok düzeltmeleri veya manuel işlemler için faydalıdır,
    ancak ana stok değişim mekanizması 'mark_movement_completed' üzerinden olmalıdır.
    """
    query = """
    INSERT INTO active_inventory (item_id, current_stock, last_updated)
    VALUES (%s, %s, CURRENT_TIMESTAMP)
    ON CONFLICT (item_id) DO UPDATE SET 
        current_stock = active_inventory.current_stock + EXCLUDED.current_stock,
        last_updated = CURRENT_TIMESTAMP
    """
    return run_command(query, (item_id, diff))
