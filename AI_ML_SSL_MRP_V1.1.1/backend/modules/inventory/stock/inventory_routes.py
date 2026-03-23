from fastapi import APIRouter
from typing import Optional

from backend.modules.inventory.stock.inventory_schemas import InventoryUpdate
from backend.modules.inventory.stock.inventory_query import get_inventory_with_details, get_current_stock
from backend.modules.inventory.stock.inventory_update import update_active_inventory_amount
from backend.shared.utils.error_handler import handle_db_error

router = APIRouter()


@router.get("/api/inventory")
def get_inventory(page: int = 1, limit: int = 50, search: Optional[str] = None, item_type: Optional[str] = None):
    try:
        offset = (page - 1) * limit
        df, total = get_inventory_with_details(item_id=search, item_type=item_type, limit=limit, offset=offset)
        return {
            "data": df.to_dict(orient="records"),
            "total": total,
            "page": page,
            "limit": limit,
            "totalPages": (total + limit - 1) // limit if limit > 0 else 1
        }
    except Exception as e:
        handle_db_error(e)


@router.put("/api/inventory/{item_id}")
def update_inventory_route(item_id: str, body: InventoryUpdate):
    try:
        current_amount = get_current_stock(item_id)
        diff = body.current_stock - current_amount
        update_active_inventory_amount(item_id, diff)
        return {"status": "success", "message": f"{item_id} stoğu güncellendi. Fark: {diff}"}
    except Exception as e:
        handle_db_error(e)


@router.get("/api/locations")
def get_locations():
    """Tüm lokasyonları getirir (API şimdilik sabit / opsiyonel db eklenebilir)"""
    # Sabit konumları döndürüyoruz. Gerekirse ileride database'den okunabilir.
    return {
        "data": [
            {"id": "ANA_DEPO", "name": "Ana Depo", "type": "depo"},
            {"id": "ÜRETİM", "name": "Üretim Sahası", "type": "saha"}
        ]
    }
