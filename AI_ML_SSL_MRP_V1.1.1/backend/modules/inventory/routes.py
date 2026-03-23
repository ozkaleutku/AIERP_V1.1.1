from fastapi import APIRouter

from backend.modules.inventory.stock.inventory_routes import router as stock_router
from backend.modules.inventory.movements.movement_routes import router as movement_router
from backend.modules.inventory.sales_records.sales_record_routes import router as sales_router

router = APIRouter()
router.include_router(stock_router)
router.include_router(movement_router)
router.include_router(sales_router)
