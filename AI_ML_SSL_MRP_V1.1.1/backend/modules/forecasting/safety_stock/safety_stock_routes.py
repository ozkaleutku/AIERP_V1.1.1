from fastapi import APIRouter, BackgroundTasks, Body
from typing import Optional, Union, List

from backend.modules.forecasting.safety_stock.safety_stock_schemas import SafetyStockApprovalPlan, ApprovalItem
from backend.modules.forecasting.safety_stock.safety_stock_query import get_calculated_safety_stock_temp, get_kings_formula_results, get_all_active_safety_stock, get_final_safety_stock, get_safety_stock_detail
from backend.modules.forecasting.safety_stock.safety_stock_approver import approve_safety_stock_plan
from backend.modules.forecasting.safety_stock.historical_consumption_builder import run_historical_bom_explosion_v2
from backend.modules.forecasting.safety_stock.lightgbm_ai_engine import run_lightgbm_analysis
from backend.modules.forecasting.safety_stock.safety_stock_calculator import run_kings_formula_analysis
from backend.modules.core.bom_explosion.bom_explosion_engine import run_bom_explosion

from backend.shared.utils.error_handler import handle_db_error


router = APIRouter()

@router.get("/api/safety-stock/proposals")
def get_safety_stock_proposals():
    """Onaylanmak üzere bekleyen önerileri (AI/Formula) döner"""
    try:
        # AI Predictions (Level Explosion Results)
        df_ai = get_calculated_safety_stock_temp()
        
        # King's Formula
        df_king = get_kings_formula_results()
        
        # Active Approvals (to show what is currently approved)
        df_active = get_all_active_safety_stock()
        
        # Merge them
        if not df_ai.empty:
            if not df_king.empty:
                df_merged = df_ai.merge(df_king, on='item_id', how='left')
            else:
                df_merged = df_ai
                df_merged['formula_result'] = None
                
            if not df_active.empty:
                # Merge current actives based on item_id AND date
                df_active['date'] = df_active['active_date']
                df_merged['date_str'] = df_merged['date'].astype(str)
                df_merged = df_merged.merge(df_active, left_on=['item_id', 'date_str'], right_on=['item_id', 'date'], how='left')
            else:
                df_merged['active_safety_stock'] = None
                df_merged['active_preference'] = None

            df_merged['date'] = df_merged['date_str'] if 'date_str' in df_merged else df_merged['date'].astype(str)
            df_merged = df_merged.where(df_merged.notnull(), None)
            
            return {"data": df_merged.to_dict(orient="records")}
        else:
             return {"data": []}
    except Exception as e:
        handle_db_error(e)

@router.post("/api/safety-stock/approve")
def approve_safety_stock(plan: Union[SafetyStockApprovalPlan, List[ApprovalItem]] = Body(...)):
    """Kullanıcının seçtiği/revize ettiği planı kalıcı tabloya aktarır."""
    try:
         items = plan if isinstance(plan, list) else plan.items
         approved_count = approve_safety_stock_plan(items)
         return {"status": "success", "message": f"{approved_count} adet kayıt başarıyla onaylandı."}
    except Exception as e:
         handle_db_error(e)

@router.get("/api/safety-stock/final")
def get_final_ss():
    """ERP'nin güncel olarak kullandığı (onaylanmış) final safety stock değerleri."""
    try:
        from datetime import date
        today = date.today().replace(day=1)
        df = get_final_safety_stock(today)
        if not df.empty:
             df['date'] = df['date'].astype(str)
        return {"data": df.to_dict(orient="records")}
    except Exception as e:
        handle_db_error(e)

@router.get("/api/safety-stock/detail/{item_id}")
def detail_safety_stock(item_id: str):
    """Component detail for charting safety stock"""
    try:
        data = get_safety_stock_detail(item_id)
        return data
    except Exception as e:
         handle_db_error(e)


# --- BACKGROUND WORKERS --- #

@router.post("/api/safety-stock/run-historical-sync")
def trigger_historical_sync(background_tasks: BackgroundTasks):
    """Geçmiş satış ve stok hareketlerini baz alıp teorik eksikleri tamamlar."""
    try:
        background_tasks.add_task(run_historical_bom_explosion_v2)
        return {"status": "success", "message": "Historical Consumption Synchronization background task started."}
    except Exception as e:
        handle_db_error(e)

@router.post("/api/safety-stock/run-ml")
def trigger_lightgbm_ml(background_tasks: BackgroundTasks):
    try:
        background_tasks.add_task(run_lightgbm_analysis)
        return {"status": "success", "message": "LightGBM ML Forecasting background task started."}
    except Exception as e:
        handle_db_error(e)

@router.post("/api/safety-stock/run-bom-explosion")
def trigger_bom_explosion(background_tasks: BackgroundTasks):
    """ML sonuçlarını (Level 0) alıp alt bileşenlere doğru patlatma işlemi."""
    try:
        background_tasks.add_task(run_bom_explosion)
        return {"status": "success", "message": "Prediction BOM Explosion background task started."}
    except Exception as e:
        handle_db_error(e)

@router.post("/api/safety-stock/run-formula")
def trigger_kings_formula(background_tasks: BackgroundTasks):
    try:
        background_tasks.add_task(run_kings_formula_analysis)
        return {"status": "success", "message": "King's Formula computation background task started."}
    except Exception as e:
        handle_db_error(e)
