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


@router.put("/api/inventory/update")
def update_inventory_batch_or_body(body: InventoryUpdate):
    try:
        item_id = body.item_id
        if not item_id:
            return {"status": "error", "message": "item_id belirtilmedi"}
        target_stock = body.current_stock if body.current_stock is not None else body.amount
        if target_stock is None:
            return {"status": "error", "message": "current_stock veya amount belirtilmedi"}
        current_amount = get_current_stock(item_id)
        diff = target_stock - current_amount
        update_active_inventory_amount(item_id, diff)
        return {"status": "success", "message": f"{item_id} stoğu güncellendi. Fark: {diff}"}
    except Exception as e:
        handle_db_error(e)


@router.put("/api/inventory/{item_id}")
def update_inventory_route(item_id: str, body: InventoryUpdate):
    try:
        target_stock = body.current_stock if body.current_stock is not None else body.amount
        if target_stock is None:
            return {"status": "error", "message": "current_stock veya amount belirtilmedi"}
        current_amount = get_current_stock(item_id)
        diff = target_stock - current_amount
        update_active_inventory_amount(item_id, diff)
        return {"status": "success", "message": f"{item_id} stoğu güncellendi. Fark: {diff}"}
    except Exception as e:
        handle_db_error(e)


@router.get("/api/locations")
def get_locations():
    """Tüm lokasyonları veritabanından getirir."""
    from backend.database.db_helper import get_db_connection, release_db_connection
    from psycopg2.extras import RealDictCursor
    conn = get_db_connection()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT location_id as id, location_name as name FROM warehouse_location WHERE is_active = true")
        locs = cur.fetchall()
        return {"data": [dict(row) for row in locs]}
    except Exception as e:
        handle_db_error(e)
    finally:
        if 'cur' in locals():
            cur.close()
        release_db_connection(conn)
