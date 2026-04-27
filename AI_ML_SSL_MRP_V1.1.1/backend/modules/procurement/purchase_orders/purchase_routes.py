from fastapi import APIRouter
from typing import Optional

from backend.modules.procurement.purchase_orders.purchase_schemas import OrderCreate, OrderUpdate, OrderEdit
from backend.modules.procurement.purchase_orders.purchase_crud import search_purchase_orders, create_purchase_order, update_purchase_order_details, delete_purchase_order
from backend.modules.procurement.purchase_orders.purchase_receiver import receive_purchase_order
from backend.shared.utils.error_handler import handle_db_error


router = APIRouter()

@router.get("/api/orders")
def get_orders(
    page: int = 1,
    limit: int = 50,
    search: Optional[str] = None,   # item_id için
    supplier: Optional[str] = None, # supplier_id için
    status: Optional[str] = None
):
    try:
        offset = (page - 1) * limit
        df, total = search_purchase_orders(
             item_id=search, 
             supplier_id=supplier, 
             status=status,
             limit=limit,
             offset=offset
        )
        
        if not df.empty:
             for col in ['purchase_date', 'expected_coming_date', 'actual_coming_date']:
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


@router.post("/api/orders")
def create_order(body: OrderCreate):
    try:
        from backend.shared.utils.validations import validate_item_for_order
        is_valid, error_msg = validate_item_for_order(body.item_id)
        if not is_valid:
            return {"status": "error", "message": error_msg}

        create_purchase_order(
            body.item_id, 
            body.supplier_id, 
            body.amount, 
            body.unit_price, 
            body.expected_coming_date, 
            body.currency
        )
        return {"status": "success"}
    except Exception as e:
        handle_db_error(e)


@router.put("/api/orders/{purchase_id}")
def update_order_status(purchase_id: int, body: OrderUpdate):
    try:
        if body.status == 'Tamamlandı' or body.status == 'Geldi':
             # Siparişi teslim al ve stok hareketini oluştur
             receive_purchase_order(
                  purchase_id, 
                  body.actual_coming_date, 
                  body.unit_price, 
                  body.amount
             )
             return {"status": "success", "message": f"{purchase_id} ID'li sipariş tamamlandı, stok eklendi."}
             
        return {"status": "success"} # Sadece Bekleniyor'dan Tamamlandı'ya geçiş destekleniyor
    except Exception as e:
        handle_db_error(e)


@router.put("/api/orders/{purchase_id}/edit")
def edit_order_details(purchase_id: int, body: OrderEdit):
    try:
        update_purchase_order_details(
            purchase_id,
            supplier_id=body.supplier_id,
            amount=body.amount,
            expected_coming_date=body.expected_coming_date
        )
        return {"status": "success"}
    except Exception as e:
         handle_db_error(e)


@router.delete("/api/orders/{purchase_id}")
def delete_order_endpoint(purchase_id: int):
    try:
         delete_purchase_order(purchase_id)
         return {"status": "success", "message": "Sipariş silindi."}
    except ValueError as ve:
         return {"status": "error", "message": str(ve)}
    except Exception as e:
         handle_db_error(e)
