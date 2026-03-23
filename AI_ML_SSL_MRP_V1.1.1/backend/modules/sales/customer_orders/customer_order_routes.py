from fastapi import APIRouter
from backend.modules.sales.customer_orders.customer_order_schemas import CustomerOrderCreate, CustomerOrderUpdate
from backend.modules.sales.customer_orders.customer_order_crud import get_customer_orders, delete_customer_order
from backend.modules.sales.customer_orders.customer_order_creator import create_customer_order
from backend.modules.sales.customer_orders.customer_order_updater import update_customer_order
from backend.shared.utils.error_handler import handle_db_error

router = APIRouter()

@router.get("/api/customer-orders")
def get_orders():
    try:
        orders = get_customer_orders()
        # Convert date to string for JSON serialization
        for order in orders:
             for col in ['order_date', 'expected_delivery_date', 'delivery_date']:
                  if order.get(col):
                       order[col] = str(order[col])
        return {"data": orders}
    except Exception as e:
        handle_db_error(e)

@router.post("/api/customer-orders")
def api_create_order(order: CustomerOrderCreate):
    try:
         result = create_customer_order(order.model_dump())
         return {"status": "success", "data": result}
    except ValueError as ve:
         return {"status": "error", "message": str(ve)}
    except Exception as e:
         handle_db_error(e)

@router.put("/api/customer-orders/{order_id}")
def api_update_order(order_id: int, updates: CustomerOrderUpdate):
    try:
        result = update_customer_order(order_id, updates.model_dump(exclude_unset=True))
        if not result:
            return {"status": "error", "message": "Order not found"}
        return {"status": "success", "data": result}
    except ValueError as ve:
         return {"status": "error", "message": str(ve)}
    except Exception as e:
         handle_db_error(e)

@router.delete("/api/customer-orders/{order_id}")
def api_delete_order(order_id: int):
    try:
         delete_customer_order(order_id)
         return {"status": "success"}
    except Exception as e:
         handle_db_error(e)

@router.post("/api/ship-order/{order_id}")
def ship_order_endpoint(order_id: int):
    """
    Siparişi manuel olarak 'Sevk Edildi' durumuna alır.
    Bu durumda sipariş silinmez ama envanterden (active_inventory) düşer ve stock_movement oluşur.
    Simülasyon etkileri de kaldırılır.
    """
    try:
         from datetime import date
         updates = {"status": "Sevk Edildi", "delivery_date": date.today()}
         result = update_customer_order(order_id, updates)
         if not result:
              return {"status": "error", "message": "Sipariş bulunamadı."}
         return {"status": "success", "message": f"{order_id} nolu sipariş sevk edildi ve stoktan düşüldü."}
    except ValueError as ve:
         return {"status": "error", "message": str(ve)}
    except Exception as e:
         handle_db_error(e)
