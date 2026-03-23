from fastapi import APIRouter

from backend.modules.core.products.product_routes import router as product_router
from backend.modules.core.bom.bom_routes import router as bom_router
from backend.modules.core.price_analytics.price_analytics_routes import router as price_router

router = APIRouter()
router.include_router(product_router)
router.include_router(bom_router)
router.include_router(price_router)
