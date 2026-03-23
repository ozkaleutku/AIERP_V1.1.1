from fastapi import APIRouter

from backend.modules.procurement.suppliers.supplier_routes import router as supplier_router
from backend.modules.procurement.purchase_orders.purchase_routes import router as purchase_router

router = APIRouter()
router.include_router(supplier_router)
router.include_router(purchase_router)
