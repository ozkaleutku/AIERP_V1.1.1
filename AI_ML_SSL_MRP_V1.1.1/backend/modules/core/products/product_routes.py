import numpy as np
from fastapi import APIRouter, BackgroundTasks
from typing import Optional

from backend.modules.core.products.product_schemas import ProductCreate, ProductUpdate
from backend.modules.core.products.product_crud import search_items, create_item, update_item
from backend.modules.core.cost_calculation.cost_calculator import recalculate_all_costs
from backend.shared.utils.error_handler import handle_db_error

router = APIRouter()


@router.get("/api/products")
def get_products(
    page: int = 1,
    limit: int = 50,
    search: Optional[str] = None,
    item_type: Optional[str] = None,
    status: Optional[str] = None
):
    try:
        offset = (page - 1) * limit
        df, total = search_items(item_id=search, item_type=item_type, status=status, limit=limit, offset=offset)
        return {
            "data": df.to_dict(orient="records"),
            "total": total,
            "page": page,
            "limit": limit,
            "totalPages": (total + limit - 1) // limit if limit > 0 else 1
        }
    except Exception as e:
        handle_db_error(e)


@router.post("/api/products")
def create_product(body: ProductCreate, background_tasks: BackgroundTasks):
    try:
        create_item(
            item_id=body.item_id,
            item_type=body.item_type,
            quantity_type=body.item_quantity_type,
            status=body.activity_status,
            unit_cost=body.unit_cost or 0,
            unit_price=body.unit_price or 0,
            additional_cost=body.additional_cost or 0,
            currency=body.currency or 'TRY',
            production_time_value=body.production_time_value or 0,
            production_time_unit=body.production_time_unit or 'saat'
        )
        background_tasks.add_task(recalculate_all_costs)
        return {"status": "success"}
    except Exception as e:
        handle_db_error(e)


@router.put("/api/products/{item_id}")
def update_product_endpoint(item_id: str, body: ProductUpdate, background_tasks: BackgroundTasks):
    try:
        update_item(
            item_id,
            item_type=body.item_type,
            quantity_type=body.item_quantity_type,
            status=body.activity_status,
            unit_cost=body.unit_cost,
            unit_price=body.unit_price,
            additional_cost=body.additional_cost,
            currency=body.currency,
            production_time_value=body.production_time_value,
            production_time_unit=body.production_time_unit
        )
        background_tasks.add_task(recalculate_all_costs)
        return {"status": "success"}
    except Exception as e:
        handle_db_error(e)


@router.post("/api/products/recalculate-costs")
def force_recalculate_costs(background_tasks: BackgroundTasks):
    try:
        background_tasks.add_task(recalculate_all_costs)
        return {"status": "Calculation started in background"}
    except Exception as e:
        handle_db_error(e)
