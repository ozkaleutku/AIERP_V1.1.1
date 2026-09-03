from backend.database.db_helper import run_command


def update_active_inventory_amount(item_id: str, diff: float):
    """
    Manuel stok düzeltmeleri için kullanılır.
    Doğrudan active_inventory güncellemek yerine 'düzeltme' (correction) hareketi ekler.
    Veritabanındaki trigger (trigger_update_active_inventory) bu hareket üzerinden active_inventory'i otomatik günceller.
    """
    from backend.modules.inventory.movements.movement_creator import add_stock_movement
    from datetime import date
    
    # Düzeltme hareketleri ANA_DEPO bazlı varsayılır
    if diff > 0:
        return add_stock_movement(item_id, diff, 'düzeltme_giriş', date.today(), target_location='ANA_DEPO', status='Tamamlandı')
    elif diff < 0:
        return add_stock_movement(item_id, abs(diff), 'düzeltme_çıkış', date.today(), source_location='ANA_DEPO', status='Tamamlandı')
    
    return None
