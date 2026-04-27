from backend.database.db_helper import run_query


def get_missing_suppliers():
    """
    Satın alma önerisi verilecek ancak 'supplier_item' tablosunda
    Aktif bir tedarikçisi olmayan zorunlu hammaddeleri bulur.
    Simülasyon bitiminde UI'da uyarı göstermek maksadıyla çağırılır.
    """
    
    # Tüm hammadde ve ticari mallardan sipariş sebebiyle stoğu biten/eksiye düşüp, 
    # 'Bekleniyor' durumunda satın alma oluşturulamayanları yakalamak için basitleştirilmiş bir SQL:
    
    sql = """
    WITH required_items AS (
        SELECT DISTINCT child_id as item_id FROM bom WHERE activity_status = 'Aktif'
        UNION
        SELECT item_id FROM item WHERE item_type IN ('hammadde') AND activity_status = 'Aktif'
    )
    SELECT r.item_id 
    FROM required_items r
    JOIN planned_inventory p ON r.item_id = p.item_id
    WHERE p.planned_stock < 0 AND r.item_id NOT IN (
        SELECT DISTINCT item_id 
        FROM supplier_item 
        WHERE activity_status = 'Aktif'
    )
    """
    df = run_query(sql)
    return df['item_id'].tolist() if not df.empty else []
