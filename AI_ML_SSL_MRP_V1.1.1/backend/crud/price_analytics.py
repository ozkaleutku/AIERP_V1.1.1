from backend.database.db_helper import run_query
import pandas as pd

def get_item_price_history(item_id: str):
    """
    Combines three sources of price data for an item:
    1. Purchase unit prices (Alış)
    2. Sales out unit prices (Satış)
    3. Official item valuation snapshots (Maliyet/Snapshot)
    """
    
    # 1. Purchase Prices
    purchase_sql = """
    SELECT date_trunc('day', purchase_date)::date as date, unit_price as purchase_price
    FROM purchase
    WHERE item_id = %s AND unit_price > 0
    ORDER BY date
    """
    df_purchase = run_query(purchase_sql, (item_id,))
    
    # 2. Sales Prices
    sales_sql = """
    SELECT date_trunc('day', date)::date as date, unit_price as sales_price
    FROM sales_out_history
    WHERE item_id = %s AND unit_price > 0
    ORDER BY date
    """
    df_sales = run_query(sales_sql, (item_id,))
    
    # 3. Snapshot History (Maliyet)
    history_sql = """
    SELECT date, unit_cost as internal_cost, unit_price as target_price
    FROM item_price_history
    WHERE item_id = %s
    ORDER BY date
    """
    df_history = run_query(history_sql, (item_id,))
    
    # Combine data
    # We want a unified timeline.
    dfs = []
    if not df_purchase.empty:
        df_purchase['date'] = pd.to_datetime(df_purchase['date'])
        dfs.append(df_purchase)
    if not df_sales.empty:
        df_sales['date'] = pd.to_datetime(df_sales['date'])
        dfs.append(df_sales)
    if not df_history.empty:
        df_history['date'] = pd.to_datetime(df_history['date'])
        dfs.append(df_history)

    if not dfs:
        return []

    # Start with the first non-empty DF and merge others
    combined = dfs[0]
    for df in dfs[1:]:
        combined = pd.merge(combined, df, on='date', how='outer')
        
    # Sort and convert date to string for JSON
    combined = combined.sort_values('date')
    combined['date'] = combined['date'].dt.strftime('%Y-%m-%d')
    
    # Replace NaN with None for JSON compliance
    # We convert to a list of dicts and then replace NaN
    # Since standard JSON cannot handle NaN
    data = combined.to_dict(orient='records')
    for row in data:
        for key, value in row.items():
            if pd.isna(value):
                row[key] = None
    return data
