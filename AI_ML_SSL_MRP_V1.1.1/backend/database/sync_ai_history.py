from backend.database.db_helper import run_query, run_command, run_command_batch
from backend.logger import get_logger
import pandas as pd
import numpy as np

logger = get_logger(__name__)

def sync_ai_history_from_consumption():
    """
    Populates ss_ai_history with synthetic past data based on historical_consumption
    for the years 2024, 2025, and 2026. This is for demo purposes to ensure the 
    'Past AI Recommendation' line is visible in charts.
    """
    logger.info("Syncing AI History from historical consumption (2024-2026)...")
    
    # 1. Fetch historical consumption for past years
    query = """
    SELECT item_id, date, amount
    FROM historical_consumption
    WHERE EXTRACT(YEAR FROM date) IN (2024, 2025, 2026)
    """
    df = run_query(query)
    
    if df.empty:
        logger.warning("No historical consumption found for 2024-2026. Cannot sync AI history.")
        return
    
    # 2. Add some random noise to make it look like "AI Predictions" (e.g., +/- 10%)
    # This prevents the blue line from perfectly overlapping the red area, 
    # which looks more realistic for a past prediction.
    np.random.seed(42)
    df['ai_amount'] = df['amount'] * (1 + np.random.uniform(-0.15, 0.15, size=len(df)))
    df['ai_amount'] = df['ai_amount'].round(2)
    
    # 3. Insert into ss_ai_history
    insert_query = """
    INSERT INTO ss_ai_history (item_id, date, amount)
    VALUES (%s, %s, %s)
    ON CONFLICT (item_id, date) DO UPDATE SET amount = EXCLUDED.amount
    """
    
    batch_data = [
        (row['item_id'], row['date'], row['ai_amount'])
        for _, row in df.iterrows()
    ]
    
    if run_command_batch(insert_query, batch_data):
        logger.info(f"Successfully synced {len(batch_data)} records to ss_ai_history.")
    else:
        logger.error("Failed to sync AI history.")

if __name__ == "__main__":
    sync_ai_history_from_consumption()
