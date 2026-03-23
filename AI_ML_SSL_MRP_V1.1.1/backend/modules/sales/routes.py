from fastapi import APIRouter

from backend.modules.sales.customer_orders.customer_order_routes import router as customer_order_router

router = APIRouter()
router.include_router(customer_order_router)
