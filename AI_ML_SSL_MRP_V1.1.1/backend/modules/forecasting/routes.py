from fastapi import APIRouter

from backend.modules.forecasting.demand_forecast.forecast_routes import router as forecast_router
from backend.modules.forecasting.safety_stock.safety_stock_routes import router as safety_stock_router

router = APIRouter()
router.include_router(forecast_router)
router.include_router(safety_stock_router)
