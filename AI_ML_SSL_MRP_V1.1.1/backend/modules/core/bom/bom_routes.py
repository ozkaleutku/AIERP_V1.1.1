from fastapi import APIRouter, BackgroundTasks

from backend.modules.core.bom.bom_schemas import BomCreate, BomUpdate
from backend.modules.core.bom.bom_crud import get_all_boms_with_details, add_bom_component, hard_delete_bom_component, update_bom_component
from backend.modules.core.cost_calculation.cost_calculator import recalculate_all_costs
from backend.shared.utils.error_handler import handle_db_error

router = APIRouter()


@router.get("/api/bom")
def get_bom():
    try:
        df = get_all_boms_with_details()
        return df.fillna("").to_dict(orient="records")
    except Exception as e:
        handle_db_error(e)


@router.post("/api/bom")
def create_bom(body: BomCreate, background_tasks: BackgroundTasks):
    try:
        add_bom_component(
            parent_id=body.parent_id,
            child_id=body.child_id,
            amount=body.amount,
            status=body.activity_status
        )
        background_tasks.add_task(recalculate_all_costs)
        return {"status": "success"}
    except Exception as e:
        handle_db_error(e)


@router.delete("/api/bom/{parent_id}/{child_id}")
def delete_bom(parent_id: str, child_id: str, background_tasks: BackgroundTasks):
    try:
        hard_delete_bom_component(parent_id, child_id)
        background_tasks.add_task(recalculate_all_costs)
        return {"status": "success"}
    except Exception as e:
        handle_db_error(e)


@router.put("/api/bom/{parent_id}/{child_id}")
def update_bom(parent_id: str, child_id: str, body: BomUpdate, background_tasks: BackgroundTasks):
    try:
        update_bom_component(
            parent_id,
            child_id,
            amount=body.amount,
            status=body.activity_status
        )
        background_tasks.add_task(recalculate_all_costs)
        return {"status": "success"}
    except Exception as e:
        handle_db_error(e)
