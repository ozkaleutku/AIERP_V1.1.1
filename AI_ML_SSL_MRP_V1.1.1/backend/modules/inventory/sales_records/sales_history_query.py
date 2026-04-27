from backend.database.db_helper import run_query


def get_all_sales_records(limit=None, offset=None):
     """
     Tüm satış geçmişi kayıtlarını (sayfalama destekli) getirir.
     Eğer bu satışın bir müşteri siparişi (order_id) varsa, o siparişe dair
     bilgileri LEFT JOIN ile çeker.
     """
     
     if limit is not None:
         count_query = "SELECT COUNT(*) as total FROM sales_out_history"
         count_df = run_query(count_query)
         total = int(count_df.iloc[0]['total']) if not count_df.empty else 0

         sql = """
         SELECT s.*, 
                co.expected_delivery_date, 
                co.amount as original_order_amount,
                co.status as order_status
         FROM sales_out_history s
         LEFT JOIN customer_orders co ON s.order_id = co.id
         ORDER BY s.date DESC 
         LIMIT %s OFFSET %s
         """
         df = run_query(sql, (limit, offset or 0))
         return df, total
     else:
         sql = """
         SELECT s.*, 
                co.expected_delivery_date, 
                co.amount as original_order_amount,
                co.status as order_status
         FROM sales_out_history s
         LEFT JOIN customer_orders co ON s.order_id = co.id
         ORDER BY s.date DESC
         """
         return run_query(sql)
