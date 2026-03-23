from backend.database.db_helper import run_command


def add_sales_record(item_id, amount, date, customer_name=None, order_id=None):
    """Geçmiş satış kaydı ekler."""
    query = """
    INSERT INTO sales_out_history (item_id, amount, date, customer_name, order_id)
    VALUES (%s, %s, %s, %s, %s)
    """
    return run_command(query, (item_id, amount, date, customer_name, order_id))

def update_sales_record(record_id, item_id=None, customer_name=None, amount=None, date=None, order_id=None):
    """Satış kaydını günceller."""
    fields = []
    params = []

    if item_id is not None:
         fields.append("item_id = %s")
         params.append(item_id)
    if customer_name is not None:
         fields.append("customer_name = %s")
         params.append(customer_name)
    if amount is not None:
         fields.append("amount = %s")
         params.append(amount)
    if date is not None:
         fields.append("date = %s")
         params.append(date)
    if order_id is not None:
         fields.append("order_id = %s")
         params.append(order_id)
         
    if not fields:
         return False

    query = f"UPDATE sales_out_history SET {', '.join(fields)} WHERE id = %s"
    params.append(record_id)
    return run_command(query, tuple(params))

def delete_sales_record(record_id):
    """Satış kaydını siler."""
    query = "DELETE FROM sales_out_history WHERE id = %s"
    return run_command(query, (record_id,))
