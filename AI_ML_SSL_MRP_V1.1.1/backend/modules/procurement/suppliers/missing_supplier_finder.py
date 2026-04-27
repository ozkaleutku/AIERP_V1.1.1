from backend.database.db_helper import run_query


def get_missing_suppliers():
    """
    Sisteme BOM ile bağlı olup veya direkt hammadde olup da herhangi bir
    Tedarikçi (Supplier) ataması yapılmamış AKTiF ürünleri (Hammaddeler dahil) bulur.
    Genellikle satın alma önerisi yapılamayan (leadtime vb. olmayan) ürünleri listelemek için kullanılır.
    """
    
    sql = """
    WITH required_items AS (
        -- 1. Herhangi bir BOM'un child_id'si olanlar (Alt bileşenler)
        SELECT DISTINCT child_id as item_id
        FROM bom
        WHERE activity_status = 'Aktif'
        
        UNION
        
        -- 2. Ya da direkt hammadde veya ticari mal olanlar (Hiç BOM'da olmasalar bile)
        SELECT item_id
        FROM item
        WHERE item_type IN ('hammadde') AND activity_status = 'Aktif'
    )
    SELECT r.item_id, i.item_type
    FROM required_items r
    JOIN item i ON r.item_id = i.item_id
    WHERE i.activity_status = 'Aktif' AND r.item_id NOT IN (
        -- Tedarikçisi olan aktif ürünler
        SELECT DISTINCT item_id 
        FROM supplier_item 
        WHERE activity_status = 'Aktif'
    )
    ORDER BY r.item_id;
    """
    
    return run_query(sql)
