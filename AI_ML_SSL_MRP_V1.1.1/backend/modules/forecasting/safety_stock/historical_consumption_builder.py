import pandas as pd
from backend.database.db_helper import run_query, run_command, run_command_batch
from backend.logger import get_logger

logger = get_logger(__name__)

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
    DO UPDATE SET amount = EXCLUDED.amount
    """
    run_command(physical_query)
    
    # 3. Perform BOM Explosion for items that don't have physical movement recorded yet
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
            
        existing_physical = run_query("SELECT DISTINCT item_id FROM stock_movement WHERE target_location_id = 'ÜRETİM'")
        physical_list = existing_physical['item_id'].tolist() if not existing_physical.empty else []
        
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
            df_current_level = pd.DataFrame()
            
        level += 1
        logger.info(f"   Level {level} theoretical explosion complete.")

    logger.info("Total Historical Consumption (Physical + Theoretical) synced!")
    logger.info("Historical BOM Explosion completed!")

if __name__ == "__main__":
    run_historical_bom_explosion_v2()
