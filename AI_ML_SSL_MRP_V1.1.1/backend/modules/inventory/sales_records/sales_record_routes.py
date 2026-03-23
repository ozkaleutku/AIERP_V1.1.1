from fastapi import APIRouter
from typing import Optional

from backend.modules.inventory.sales_records.sales_record_schemas import SalesRecordCreate, SalesRecordUpdate
from backend.modules.inventory.sales_records.sales_record_crud import add_sales_record, update_sales_record, delete_sales_record
from backend.modules.inventory.sales_records.sales_history_query import get_all_sales_records
from backend.shared.utils.error_handler import handle_db_error

router = APIRouter()

@router.get("/api/sales")
def get_sales(page: int = 1, limit: int = 50):
    try:
        offset = (page - 1) * limit
        df, total = get_all_sales_records(limit=limit, offset=offset)
        
        # Convert date objects to string for JSON serialization
        if not df.empty:
             for col in ['date', 'expected_delivery_date']:
                  if col in df.columns:
                      df[col] = df[col].astype(str)
                      
        return {
            "data": df.fillna("").to_dict(orient="records"),
            "total": total,
            "page": page,
            "limit": limit,
            "totalPages": (total + limit - 1) // limit if limit > 0 else 1
        }
    except Exception as e:
        handle_db_error(e)

@router.post("/api/sales")
def create_sales_record(body: SalesRecordCreate):
    try:
         add_sales_record(body.item_id, body.amount, body.date, body.customer_name, body.order_id)
         return {"status": "success"}
    except Exception as e:
         handle_db_error(e)

@router.put("/api/sales/{record_id}")
def update_sales_record_endpoint(record_id: int, body: SalesRecordUpdate):
    try:
         update_sales_record(
             record_id,
             item_id=body.item_id,
             customer_name=body.customer_name,
             amount=body.amount,
             date=body.date,
             order_id=body.order_id
         )
         return {"status": "success"}
    except Exception as e:
         handle_db_error(e)

@router.delete("/api/sales/{record_id}")
def delete_sales_record_endpoint(record_id: int):
    try:
         delete_sales_record(record_id)
         return {"status": "success"}
    except Exception as e:
         handle_db_error(e)
