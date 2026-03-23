from fastapi import APIRouter
from backend.modules.simulation.order_map.sim_manager import rebuild_simulation_from_scratch, get_simulation_results
from backend.shared.utils.error_handler import handle_db_error

router = APIRouter()

@router.post("/api/simulation/run")
def run_simulation(full_rebuild: bool = True):
    """MRP/Sipariş Simülasyonunu baştan tetikler."""
    try:
        if full_rebuild:
            warnings = rebuild_simulation_from_scratch()
            return {"status": "success", "message": "Simülasyon baştan çalıştırıldı.", "warnings": warnings}
        else:
            return {"status": "error", "message": "Şu an sadece tam yenileme destekleniyor."}
    except Exception as e:
         handle_db_error(e)

@router.get("/api/simulation/results")
def fetch_simulation_results():
    """Simülasyonun güncel sonuçlarını döndürür."""
    try:
         data = get_simulation_results()
         return {"data": data}
    except Exception as e:
         handle_db_error(e)
