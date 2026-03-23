from fastapi import APIRouter

from backend.modules.simulation.order_map.simulation_routes import router as sim_router

router = APIRouter()
router.include_router(sim_router)
