from fastapi import APIRouter
from typing import Optional

from backend.modules.procurement.suppliers.supplier_schemas import SupplierItemCreate, SupplierItemUpdate
from backend.modules.procurement.suppliers.supplier_crud import search_supplier_items, add_supplier_item, update_supplier_item, hard_delete_supplier_item
from backend.modules.procurement.suppliers.missing_supplier_finder import get_missing_suppliers
from backend.shared.utils.error_handler import handle_db_error


router = APIRouter()

@router.get("/api/suppliers")
def get_supplier_items(
    page: int = 1,
    limit: int = 50,
    search: Optional[str] = None,   # item_id için
    supplier: Optional[str] = None, # supplier_id için
    status: Optional[str] = None
):
    try:
        offset = (page - 1) * limit
        df, total = search_supplier_items(
             item_id=search, 
             supplier_id=supplier, 
             status=status,
             limit=limit,
             offset=offset
        )
        return {
             "data": df.fillna("").to_dict(orient="records"),
             "total": total,
             "page": page,
             "limit": limit,
             "totalPages": (total + limit - 1) // limit if limit > 0 else 1
        }
    except Exception as e:
        handle_db_error(e)


@router.post("/api/suppliers")
def create_supplier_item(body: SupplierItemCreate):
    try:
        final_status = body.status or body.activity_status or 'Aktif'
        add_supplier_item(
            item_id=body.item_id,
            supplier_id=body.supplier_id,
            given_leadtime=body.given_leadtime,
            given_leadtime_deviation=body.given_leadtime_deviation or 0,
            lot_size=body.lot_size or 0,
            min_size=body.min_size or 0,
            max_size=body.max_size or 0,
            calculated=body.calculated or False,
            status=final_status
        )
        return {"status": "success"}
    except Exception as e:
        handle_db_error(e)


@router.put("/api/suppliers/update")
def update_supplier_body_endpoint(body: SupplierItemUpdate):
    try:
        item_id = body.item_id
        supplier_id = body.supplier_id
        if not item_id or not supplier_id:
            return {"status": "error", "message": "item_id ve supplier_id gereklidir."}
        update_supplier_item(
            item_id=item_id,
            supplier_id=supplier_id,
            given_leadtime=body.given_leadtime,
            given_leadtime_deviation=body.given_leadtime_deviation,
            lot_size=body.lot_size,
            min_size=body.min_size,
            max_size=body.max_size,
            calculated=body.calculated,
            status=body.status or body.activity_status
        )
        return {"status": "success"}
    except Exception as e:
        handle_db_error(e)


@router.put("/api/suppliers/{item_id}/{supplier_id}")
def update_supplier_endpoint(item_id: str, supplier_id: str, body: SupplierItemUpdate):
    try:
        update_supplier_item(
            item_id=item_id,
            supplier_id=supplier_id,
            given_leadtime=body.given_leadtime,
            given_leadtime_deviation=body.given_leadtime_deviation,
            lot_size=body.lot_size,
            min_size=body.min_size,
            max_size=body.max_size,
            calculated=body.calculated,
            status=body.status or body.activity_status
        )
        return {"status": "success"}
    except Exception as e:
        handle_db_error(e)


@router.delete("/api/suppliers/{item_id}/{supplier_id}")
def delete_supplier_item_endpoint(item_id: str, supplier_id: str):
    try:
         hard_delete_supplier_item(item_id, supplier_id)
         return {"status": "success"}
    except Exception as e:
         handle_db_error(e)


@router.get("/api/suppliers/missing")
def check_missing_suppliers():
    """Tedarikçisi olmayan zorunlu öğeleri (hammadde vs.) listeler."""
    try:
        df = get_missing_suppliers()
        return {"data": df.to_dict(orient="records")}
    except Exception as e:
        handle_db_error(e)
