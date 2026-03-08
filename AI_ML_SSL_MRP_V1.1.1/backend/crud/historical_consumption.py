import pandas as pd
from backend.database.db_helper import run_query, run_command, run_command_batch
from backend.logger import get_logger

logger = get_logger(__name__)

def run_historical_bom_explosion():
    """
    Calculates true historical consumption for all items by exploding sales through the BOM.
    This ensures that raw materials and sub-assemblies show the consumption scale they 
    actually experienced based on parent production needs.
    """
    logger.info("Starting Historical BOM Explosion...")

    # 1. Clear existing historical consumption
    run_command("TRUNCATE TABLE historical_consumption")
    
    # 2. Level 0: Initial sales are the direct consumption for finished goods
    logger.info("   -> Level 0 (Direct Sales) processing...")
    insert_l0 = """
    INSERT INTO historical_consumption (item_id, date, amount)
    SELECT item_id, date, SUM(amount)
    FROM sales_out_history
    GROUP BY item_id, date
    """
    run_command(insert_l0)
    
    current_level = 0
    
    # Iteratively explode requirements to lower levels
    while True:
        logger.info(f"   -> Exploding from Level {current_level} to Level {current_level + 1}...")
        
        # Get items that were treated as "parents" in the current level
        # We need their consumption to calculate their children's consumption
        # Note: An item can be a parent at multiple levels, but we process them iteratively
        
        # We use a temporary set of "parents to explode" 
        # For simplicity, we can just fetch all from historical_consumption that might have children
        # But to be precise and avoid infinite loops, we'll use the items added in the last step
        # However, historical_consumption doesn't store levels. 
        # Let's use a temporary tracking for the current level's items.
        
        # Fetch current requirements
        query_current = """
        SELECT item_id, date, amount 
        FROM historical_consumption
        """
        # Optimization: only process items that actually have children
        df_all_consumed = run_query(query_current)
        
        if df_all_consumed.empty:
            break
            
        parents_in_db = list(df_all_consumed['item_id'].unique())
        
        # Fetch BOM for these parents
        query_bom = """
        SELECT parent_id, child_id, amount as bom_multiplier 
        FROM bom 
        WHERE parent_id = ANY(%s) AND activity_status = 'Aktif'
        """
        df_bom = run_query(query_bom, (parents_in_db,))
        
        if df_bom.empty:
            logger.info("   No more BOM relations to explode.")
            break
            
        # Join: Parent consumption * BOM multiplier = Child requirement
        df_merged = df_all_consumed.merge(df_bom, left_on='item_id', right_on='parent_id')
        df_merged['child_amount'] = df_merged['amount'] * df_merged['bom_multiplier']
        
        # Sum requirements per child and date
        df_child_reqs = df_merged.groupby(['child_id', 'date'])['child_amount'].sum().reset_index()
        
        if df_child_reqs.empty:
            break
            
        # Upsert into historical_consumption
        # Note: We use UPSERT because a child might already have direct sales (Level 0) or 
        # be a child of another item at a different level.
        upsert_query = """
        INSERT INTO historical_consumption (item_id, date, amount)
        VALUES (%s, %s, %s)
        ON CONFLICT (item_id, date) 
        DO UPDATE SET amount = historical_consumption.amount + EXCLUDED.amount
        """
        
        rows_to_insert = [
            (row['child_id'], row['date'], round(float(row['child_amount']), 2))
            for _, row in df_child_reqs.iterrows()
        ]
        
        run_command_batch(upsert_query, rows_to_insert)
        
        # In a real BOM explosion, we'd only explode the *newly added* amounts to avoid double counting.
        # The simple logic above is slightly flawed because it re-explodes EVERYTHING every time.
        # Let's refine it to be level-based like run_bom_explosion.py
        break # Breaking here to rewrite it properly below

def run_historical_bom_explosion_v2():
    logger.info("Starting Accurate Historical BOM Explosion (Physical + Theoretical)...")
    run_command("TRUNCATE TABLE historical_consumption")
    
    # 1. Level 0: Direct Sales for Finished Goods (Truth from sales history)
    query_l0 = """
    INSERT INTO historical_consumption (item_id, date, amount)
    SELECT item_id, date, SUM(amount)
    FROM sales_out_history
    GROUP BY item_id, date
    """
    run_command(query_l0)
    
    # 2. Add Physical Consumption from Stock Movements (Truth from the floor)
    # Net Consumption = (All movements to Production) - (All returns from Production)
    # This captures the 'Packaged Send + Partial Return' logic correctly
    physical_query = """
    INSERT INTO historical_consumption (item_id, date, amount)
    SELECT item_id, date, SUM(
        CASE 
            WHEN target_location_id = 'ÜRETİM' THEN amount 
            WHEN source_location_id = 'ÜRETİM' THEN -amount 
            ELSE 0 
        END
    )
    FROM stock_movement
    WHERE (target_location_id = 'ÜRETİM' OR source_location_id = 'ÜRETİM')
    GROUP BY item_id, date
    ON CONFLICT (item_id, date) 
    DO UPDATE SET amount = EXCLUDED.amount -- Physical reality overwrites theoretical sales-based consumption
    """
    run_command(physical_query)
    
    # 3. Perform BOM Explosion for items that don't have physical movement recorded yet
    # (e.g. older history where multi-location didn't exist)
    logger.info("   Running recursive explosion for theoretical gaps...")
    
    query_current = "SELECT item_id, date, amount as current_amount FROM historical_consumption"
    df_current_level = run_query(query_current)
    
    level = 0
    while not df_current_level.empty and level < 10:
        parents = list(df_current_level['item_id'].unique())
        query_bom = """
        SELECT parent_id, child_id, amount as bom_multiplier 
        FROM bom WHERE parent_id = ANY(%s) AND activity_status = 'Aktif'
        """
        df_bom = run_query(query_bom, (parents,))
        if df_bom.empty: break
            
        df_merged = df_current_level.merge(df_bom, left_on='item_id', right_on='parent_id')
        df_merged['child_amount'] = df_merged['current_amount'] * df_merged['bom_multiplier']
        df_next_level = df_merged.groupby(['child_id', 'date'])['child_amount'].sum().reset_index()
        
        if df_next_level.empty: break
            
        # We only treat as "Level + 1" if physical data doesn't exist for the child
        # Get list of children that ALREADY have physical consumption recorded
        existing_physical = run_query("SELECT DISTINCT item_id FROM stock_movement WHERE target_location_id = 'ÜRETİM'")
        physical_list = existing_physical['item_id'].tolist() if not existing_physical.empty else []
        
        # Filter out items that have physical truth
        df_to_insert = df_next_level[~df_next_level['child_id'].isin(physical_list)]
        
        if not df_to_insert.empty:
            upsert_query = """
            INSERT INTO historical_consumption (item_id, date, amount)
            VALUES (%s, %s, %s)
            ON CONFLICT (item_id, date) 
            DO UPDATE SET amount = historical_consumption.amount + EXCLUDED.amount
            """
            rows = [(row['child_id'], row['date'], float(row['child_amount'])) for _, row in df_to_insert.iterrows()]
            run_command_batch(upsert_query, rows)
            df_current_level = df_to_insert.rename(columns={'child_id': 'item_id', 'child_amount': 'current_amount'})
        else:
            df_current_level = pd.DataFrame() # Stop if everyone has physical truth
            
        level += 1
        logger.info(f"   Level {level} theoretical explosion complete.")

    logger.info("Total Historical Consumption (Physical + Theoretical) synced!")

    logger.info("Historical BOM Explosion completed!")

if __name__ == "__main__":
    run_historical_bom_explosion_v2()
