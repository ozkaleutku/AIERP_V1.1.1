import sys
import os

# Add backend root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.logger import get_logger

logger = get_logger(__name__)

app = FastAPI(title="OptiStock AI - ERP MRP System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
    return {"message": "OptiStock AI - ERP MRP System API is Running (Modular)"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
