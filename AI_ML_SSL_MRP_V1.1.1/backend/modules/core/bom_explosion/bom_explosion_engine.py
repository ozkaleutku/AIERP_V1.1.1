from backend.database.db_helper import run_query, run_command, run_command_batch
from backend.logger import get_logger

logger = get_logger(__name__)


def run_bom_explosion():
    """
    Hedef yılın (önümüzdeki yılbaşı) tahminleri için BOM patlatma işlemini gerçekleştirir.
    Level-by-level (seviye bazlı) algoritma kullanır ve sonuçları
    `calculated_full_ss_ai_temp` tablosuna yazar.
    
    FIX: Artık çok-seviyeli patlatma (multi-level explosion) doğru çalışıyor.
    Her seviyede sadece yeni eklenen child'lar bir sonraki iterasyon için
    parent olarak kullanılır.
    """
    from datetime import datetime
    target_year = datetime.now().year + 1
    logger.info(f"Starting Prediction BOM Explosion for Target Year: {target_year}")
    
    # 1. Clear temporary calculation table
    run_command("TRUNCATE TABLE calculated_full_ss_ai_temp")
    
    # 2. Level 0: Fetch raw AI predictions
    logger.info(f"   -> Copying initial AI predictions (Level 0) for target year: {target_year}...")
    
    insert_l0 = """
    INSERT INTO calculated_full_ss_ai_temp (item_id, item_type, item_quantity_type, date, amount, status)
    SELECT p.item_id, i.item_type, i.item_quantity_type, p.date, p.amount, i.activity_status
    FROM ss_ai_temporary p
    JOIN item i ON p.item_id = i.item_id
    WHERE EXTRACT(YEAR FROM p.date) = %s
    """
    run_command(insert_l0, (target_year,))
    
    # 3. Level-by-level explosion
    # Track which items were just exploded so we only process the DELTA in each loop
    import pandas as pd
    
    # Get the initial set of parents (mamül + yarı_mamül)
    query_initial = """
    SELECT c.item_id, c.date, c.amount as current_amount
    FROM calculated_full_ss_ai_temp c
    JOIN item i ON c.item_id = i.item_id
    WHERE i.item_type IN ('mamül', 'yarı_mamül')
    """
    df_current_level = run_query(query_initial)
    
    level = 0
    while not df_current_level.empty and level < 10:
        logger.info(f"   -> Processing explosion for Level {level}...")
        
        parents_in_level = list(df_current_level['item_id'].unique())
        
        # Get BOM for these parents
        query_bom = """
        SELECT parent_id, child_id, amount as bom_multiplier 
        FROM bom 
        WHERE parent_id = ANY(%s) AND activity_status = 'Aktif'
        """
        df_bom = run_query(query_bom, (parents_in_level,))
        
        if df_bom.empty:
            break
            
        # Explode: current_required * bom_multiplier = child_required
        df_merged = df_current_level.merge(df_bom, left_on='item_id', right_on='parent_id')
        df_merged['child_amount'] = df_merged['current_amount'] * df_merged['bom_multiplier']
        
        # Group by child and date to sum up requirements from multiple parents
        df_next_level = df_merged.groupby(['child_id', 'date'])['child_amount'].sum().reset_index()
        
        if df_next_level.empty:
            break
            
        # Get item details for next insertion
        children = list(df_next_level['child_id'].unique())
        query_items = "SELECT item_id, item_type, item_quantity_type, activity_status FROM item WHERE item_id = ANY(%s)"
        df_items = run_query(query_items, (children,))
        
        # Join item details
        df_insert = df_next_level.merge(df_items, left_on='child_id', right_on='item_id')
        
        if df_insert.empty:
            break
             
        # Insert or Add to temp table
        upsert_query = """
        INSERT INTO calculated_full_ss_ai_temp (item_id, item_type, item_quantity_type, date, amount, status)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (item_id, date, status) DO UPDATE 
        SET amount = calculated_full_ss_ai_temp.amount + EXCLUDED.amount
        """
        
        rows = [
             (
                  row['item_id'], row['item_type'], row['item_quantity_type'], 
                  row['date'], float(row['child_amount']), row['activity_status']
             )
             for _, row in df_insert.iterrows()
        ]
        
        run_command_batch(upsert_query, rows)
        
        # KEY FIX: Only process newly generated children that are mamül/yarı_mamül
        # in the next iteration (to avoid re-exploding top-level parents)
        df_next_parents = df_insert[df_insert['item_type'].isin(['mamül', 'yarı_mamül'])].copy()
        
        if df_next_parents.empty:
            break
        
        # Prepare next level: rename columns to match expected format
        df_current_level = df_next_parents[['item_id', 'date', 'child_amount']].rename(
            columns={'child_amount': 'current_amount'}
        )
        
        level += 1
               
    logger.info(f"Prediction BOM Explosion completed! ({level + 1} levels processed)")
