from fastapi import APIRouter
from typing import Optional

from backend.modules.inventory.movements.movement_schemas import StockMovementCreate
from backend.modules.inventory.movements.movement_query import search_stock_movements
from backend.modules.inventory.movements.movement_creator import add_stock_movement
from backend.modules.inventory.movements.movement_completer import mark_movement_completed
from backend.shared.utils.error_handler import handle_db_error

router = APIRouter()


@router.get("/api/stock-movements")
def get_stock_movements(
    page: int = 1,
    limit: int = 50,
    search: Optional[str] = None,
    purpose: Optional[str] = None,
    order_id: Optional[int] = None
):
    try:
        offset = (page - 1) * limit
        df, total = search_stock_movements(
            item_id=search, 
            purpose=purpose, 
            order_id=order_id, 
            limit=limit, 
            offset=offset
        )
        return {
            "data": df.to_dict(orient="records"),
            "total": total,
            "page": page,
            "limit": limit,
            "totalPages": (total + limit - 1) // limit if limit > 0 else 1
        }
    except Exception as e:
        handle_db_error(e)


@router.post("/api/stock-movements")
def create_stock_movement(body: StockMovementCreate):
    try:
         # status her zaman Tamamlandı olarak gönderilir API'den manuel girişlerde
         status = 'Tamamlandı'
         add_stock_movement(
             body.item_id, 
             body.amount, 
             body.purpose, 
             body.date, 
             body.order_id,
             # Frontend'den gelmiyorsa creator içindeki logic handle eder
             status=status
         )
         return {"status": "success"}
    except Exception as e:
        handle_db_error(e)


@router.post("/api/stock-movements/complete/{movement_id}")
def complete_movement(movement_id: int):
    """
    Belirli bir stok hareketini (genelde üretim çıkışı) manuel tamamlandı olarak işaretler.
    Bu işlem sonucunda Order Material Consumption ve ilgili sipariş durumu (Hazır) güncellenir.
    """
    try:
        mark_movement_completed(movement_id)
        return {"status": "success", "message": f"Sipariş S{movement_id} için manuel sevk hareketi tamamlandı. Ürün üretimden depoya geçti."}
    except Exception as e:
         handle_db_error(e)
