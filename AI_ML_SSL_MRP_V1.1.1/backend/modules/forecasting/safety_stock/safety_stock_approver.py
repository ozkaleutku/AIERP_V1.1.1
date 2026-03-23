from backend.database.db_helper import run_command_batch


def approve_safety_stock_plan(approval_list):
    """
    Safety Stock önerilerini 'final_safety_stock' tablosuna işler.
    
    approval_list: List of dicts or objects with (item_id, date, amount, item_quantity_type, preference)
    """
    # Batch Upsert (ON CONFLICT)
    sql_upsert = """
    INSERT INTO final_safety_stock (item_id, date, safety_stock, item_quantity_type, preference)
    VALUES (%s, %s, %s, %s, %s)
    ON CONFLICT (item_id, date) 
    DO UPDATE SET safety_stock = EXCLUDED.safety_stock, item_quantity_type = EXCLUDED.item_quantity_type, preference = EXCLUDED.preference
    """
    
    batch_data = [
        (item.item_id, item.date, item.amount, item.item_quantity_type, getattr(item, 'preference', 'AI'))
        for item in approval_list
    ]
    
    if batch_data:
        run_command_batch(sql_upsert, batch_data)
        
    return len(batch_data)
