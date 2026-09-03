import sys
import os

# Add backend root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.logger import get_logger

logger = get_logger(__name__)

from backend.config import CORS_ORIGINS

app = FastAPI(title="AIERP - ERP MRP System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Register Module Routers ---
try:
    from backend.modules.core.routes import router as core_router
    from backend.modules.inventory.routes import router as inventory_router
    from backend.modules.procurement.routes import router as procurement_router
    from backend.modules.sales.routes import router as sales_router
    from backend.modules.forecasting.routes import router as forecasting_router
    from backend.modules.simulation.routes import router as simulation_router

    app.include_router(core_router)
    app.include_router(inventory_router)
    app.include_router(procurement_router)
    app.include_router(sales_router)
    app.include_router(forecasting_router)
    app.include_router(simulation_router)

except ImportError as e:
    logger.warning(f"Warning: Could not import module routers: {e}")


@app.get("/")
def read_root():
    return {"message": "AIERP - ERP MRP System API is Running (Modular)"}


from backend.config import API_PORT, API_HOST, API_RELOAD

if __name__ == "__main__":
    import uvicorn
    logger.info(f"Starting server on {API_HOST}:{API_PORT} (Reload: {API_RELOAD})")
    uvicorn.run("main:app", host=API_HOST, port=API_PORT, reload=API_RELOAD)
