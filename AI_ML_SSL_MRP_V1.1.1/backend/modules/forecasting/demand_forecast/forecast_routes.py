from fastapi import APIRouter, BackgroundTasks, Body
from typing import Optional, Union, Dict, Any, List
from backend.modules.forecasting.demand_forecast.forecast_schemas import ForecastUpdate, ForecastApprovalBulk, ForecastApprovalItem
from backend.modules.forecasting.demand_forecast.forecast_query import get_forecast_data, get_item_forecast_detail
from backend.modules.forecasting.demand_forecast.forecast_updater import update_forecast_data
from backend.modules.forecasting.demand_forecast.forecast_approver import approve_forecast
from backend.modules.forecasting.demand_forecast.prophet_ai_engine import run_full_analysis
from backend.modules.forecasting.demand_forecast.generate_historical_forecasts import generate_all_history
from backend.shared.utils.error_handler import handle_db_error


router = APIRouter()

@router.get("/api/forecast")
def get_forecast():
    """Tüm Prophet tahminlerini JSON formatında döner."""
    try:
        df = get_forecast_data()
        if not df.empty:
            df['date'] = df['date'].astype(str)
        return {"data": df.fillna("").to_dict(orient="records")}
    except Exception as e:
        handle_db_error(e)

@router.get("/api/forecast/{item_id}")
def get_forecast_detail(item_id: str):
    """Bir ürünün Prophet tahmin detaylarını ve geçmiş satışlarını döner."""
    try:
        result = get_item_forecast_detail(item_id)
        df_forecast = result["forecast"]
        df_sales = result["sales_history"]
        
        if not df_forecast.empty:
             df_forecast['date'] = df_forecast['date'].astype(str)
             
        return {
             "forecast": df_forecast.fillna("").to_dict(orient="records"),
             "sales_history": df_sales.fillna("").to_dict(orient="records")
        }
    except Exception as e:
        handle_db_error(e)

@router.put("/api/forecast/update")
def update_forecast_value(body: ForecastUpdate):
    """Plandaki (Prophet temporary) tek bir hücre değerini manuel revize eder."""
    try:
        update_forecast_data(body.item_id, body.date, body.amount)
        return {"status": "success", "message": f"{body.item_id} için {body.date} tahmini güncellendi."}
    except Exception as e:
        handle_db_error(e)

@router.post("/api/forecast/approve")
def approve_forecast_bulk(body: Optional[Union[ForecastApprovalBulk, ForecastApprovalItem, Dict[str, Any]]] = Body(None)):
    """Seçili satırları, tekil hücreyi veya tüm tabloyu History tablosuna taşır."""
    try:
        if body is None or not body:
            approve_forecast()
            return {"status": "success", "message": "Tüm geçici tahminler onaylandı."}
            
        if isinstance(body, ForecastApprovalBulk) or (isinstance(body, dict) and "items" in body):
            items = body.items if isinstance(body, ForecastApprovalBulk) else body["items"]
            for item in items:
                item_id = item.item_id if hasattr(item, "item_id") else item.get("item_id")
                date = item.date if hasattr(item, "date") else item.get("date")
                if item_id and date:
                    approve_forecast(item_id, date)
            return {"status": "success", "message": f"{len(items)} adet tahmin onaylandı."}

        item_id = body.item_id if hasattr(body, "item_id") else body.get("item_id")
        date = body.date if hasattr(body, "date") else body.get("date")
        if item_id and date:
            approve_forecast(item_id, date)
            return {"status": "success", "message": f"{item_id} için {date} tahmini onaylandı."}
            
        approve_forecast()
        return {"status": "success", "message": "Tahminler onaylandı."}
    except Exception as e:
        handle_db_error(e)

@router.post("/api/forecast/run-ai")
def trigger_ai_analysis(background_tasks: BackgroundTasks):
    """Tüm veriler için Prophet yapay zeka analizini tetikler."""
    try:
         background_tasks.add_task(run_full_analysis)
         return {"status": "success", "message": "Prophet Yapay Zeka Analizi arka planda başlatıldı."}
    except Exception as e:
         handle_db_error(e)

@router.post("/api/forecast/generate-history")
def trigger_historical_generation(background_tasks: BackgroundTasks):
    """Geçmiş yıllar için Prophet tahminlerini geriye dönük oluşturur.
    LightGBM eğitim setini zenginleştirmek için kullanılır."""
    try:
         background_tasks.add_task(generate_all_history)
         return {"status": "success", "message": "Geçmiş yıl Prophet tahminleri arka planda üretiliyor."}
    except Exception as e:
         handle_db_error(e)

