import sys
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
import pandas as pd
from datetime import date, datetime
import psycopg2 

# Add backend root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.logger import get_logger
logger = get_logger(__name__)

try:
    # Importing CRUD modules
    # Not: run_query artık main.py içinde kullanılmıyor, sadece modüller üzerinden erişiliyor.
    # sales modülü silindi, stock üzerinden yönetiliyor.
    from backend.crud.customer_orders import CustomerOrderCreate, CustomerOrderUpdate
    from backend.simulation import sim_manager
    from backend.AI_ML import prophet
except ImportError as e:
    logger.warning(f"Warning: Could not import local modules: {e}")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Models ---
class StockMovementCreate(BaseModel):
    item_id: str
    amount: float = Field(..., gt=0, description="Miktar 0'dan büyük olmalı")
    purpose: str
    date: Optional[str] = None
    order_id: Optional[int] = None

class SupplierItemCreate(BaseModel):
    item_id: str
    supplier_id: str
    given_leadtime: float = Field(..., gt=0)
    given_leadtime_deviation: float = Field(0, ge=0)
    lot_size: float = Field(0, ge=0)
    min_size: float = Field(0, ge=0)
    max_size: float = Field(0, ge=0)
    calculated: bool = False
    status: str = 'Aktif'

class SupplierItemUpdate(BaseModel):
    item_id: str
    supplier_id: str
    given_leadtime: Optional[float] = Field(None, gt=0)
    given_leadtime_deviation: Optional[float] = Field(None, ge=0)
    lot_size: Optional[float] = Field(None, ge=0)
    min_size: Optional[float] = Field(None, ge=0)
    max_size: Optional[float] = Field(None, ge=0)
    calculated: Optional[bool] = None
    status: Optional[str] = None

class OrderCreate(BaseModel):
    item_id: str
    supplier_id: str
    amount: float = Field(..., gt=0)
    purpose: str
    purchase_date: str
    expected_coming_date: str

class OrderUpdate(BaseModel):
    id: int
    actual_coming_date: str

class OrderEdit(BaseModel):
    id: int
    item_id: Optional[str] = None
    supplier_id: Optional[str] = None
    amount: Optional[float] = Field(None, gt=0)
    purpose: Optional[str] = None
    purchase_date: Optional[str] = None
    expected_coming_date: Optional[str] = None

class InventoryUpdate(BaseModel):
    item_id: str
    amount: float = Field(..., ge=0)

class ForecastUpdate(BaseModel):
    item_id: str
    date: str
    amount: float = Field(..., ge=0)

class ProductCreate(BaseModel):
    item_id: str
    item_type: str
    item_quantity_type: str
    activity_status: str

class BomCreate(BaseModel):
    parent_id: str
    child_id: str
    amount: float = Field(..., gt=0)
    activity_status: str

class SalesRecordCreate(BaseModel):
    item_id: str
    amount: float = Field(..., gt=0)
    date: str

class SalesRecordUpdate(BaseModel):
    id: int
    item_id: Optional[str] = None
    amount: Optional[float] = Field(None, gt=0)
    date: Optional[str] = None

class ApprovalItem(BaseModel):
    item_id: str
    date: str
    amount: float = Field(..., ge=0)
    item_quantity_type: Optional[str] = None

# --- Helper for Graceful Error Handling ---
def handle_db_error(e):
    err_msg = str(e)
    if isinstance(e, psycopg2.errors.ForeignKeyViolation):
        raise HTTPException(status_code=409, detail=f"İşlem yapılamadı: Kayıt başka bir yerde kullanılıyor. (FK Error)")
    if isinstance(e, psycopg2.errors.UniqueViolation):
        raise HTTPException(status_code=409, detail=f"Bu kayıt zaten mevcut.")
    if "update or delete on table" in err_msg and "violates foreign key constraint" in err_msg:
         raise HTTPException(status_code=409, detail="Bu kayıt silinemez çünkü başka verilerle ilişkili (Sipariş veya Reçete).")
    
    # Generic Internal Error
    logger.error(f"DB Error: {e}")
    raise HTTPException(status_code=500, detail=err_msg)


@app.get("/")
def read_root():
    return {"message": "AI-Driven MRP System API is Running (Refactored)"}

# ---------------------------------------------------------
# 1. Products (refactored)
# ---------------------------------------------------------
@app.get("/api/products")
def get_products(
    page: int = 1, 
    limit: int = 50, 
    search: Optional[str] = None, 
    item_type: Optional[str] = None, 
    status: Optional[str] = None
):
    try:
        # Not: Pagination logic crud/item.py içinde yoktu, mecburen burada yapacağız 
        # veya item.py search_items'a limit offset ekleyebilirdik.
        # Zaman kazanmak için search_items kullanıp Pandas ile slice edebiliriz 
        # (Veri az olduğu için sorun değil, ileride SQL'e taşınmalı).
        
        df = item.search_items(item_id=search, item_type=item_type, status=status)
        
        total = len(df)
        start = (page - 1) * limit
        end = start + limit
        
        sliced_df = df.iloc[start:end]
        
        return {
            "data": sliced_df.to_dict(orient="records"),
            "total": total,
            "page": page,
            "limit": limit,
            "totalPages": (total + limit - 1) // limit if limit > 0 else 1
        }
    except Exception as e:
        handle_db_error(e)

@app.post("/api/products")
def create_product(body: ProductCreate):
    try:
        item.create_item(
            item_id=body.item_id,
            item_type=body.item_type,
            quantity_type=body.item_quantity_type,
            status=body.activity_status
        )
        return {"status": "success"}
    except Exception as e:
        handle_db_error(e)

@app.put("/api/products/{item_id}")
def update_product_endpoint(item_id: str, body: dict):
    try:
        # body['min_buffer'] ve 'activity_status' gelebilir
        min_buf = body.get('min_buffer')
        status = body.get('activity_status')
        
        item.update_item(item_id, status=status, min_buffer=min_buf)
        return {"status": "success"}
    except Exception as e:
        handle_db_error(e)

@app.delete("/api/products/{item_id}")
def delete_product(item_id: str):
    try:
        item.hard_delete_item(item_id)
        return {"status": "success"}
    except Exception as e:
        handle_db_error(e)

# ---------------------------------------------------------
# 2. Bom (refactored)
# ---------------------------------------------------------
@app.get("/api/bom")
def get_bom():
    try:
        df = bom.get_all_boms_with_details()
        return df.fillna("").to_dict(orient="records")
    except Exception as e:
        handle_db_error(e)

@app.post("/api/bom")
def create_bom(body: BomCreate):
    try:
        bom.add_bom_component(
            parent_id=body.parent_id,
            child_id=body.child_id,
            amount=body.amount,
            status=body.activity_status
        )
        return {"status": "success"}
    except Exception as e:
        handle_db_error(e)

@app.delete("/api/bom/{parent_id}/{child_id}")
def delete_bom(parent_id: str, child_id: str):
    try:
        bom.hard_delete_bom_component(parent_id, child_id)
        return {"status": "success"}
    except Exception as e:
        handle_db_error(e)

@app.put("/api/bom/{parent_id}/{child_id}")
def update_bom(parent_id: str, child_id: str, body: dict):
    try:
        bom.update_bom_component(
            parent_id, 
            child_id, 
            amount=body.get('amount'), 
            status=body.get('activity_status', 'Aktif')
        )
        return {"status": "success"}
    except Exception as e:
        handle_db_error(e)

# ---------------------------------------------------------
# 3. Suppliers (refactored)
# ---------------------------------------------------------
@app.get("/api/suppliers")
def get_suppliers():
    try:
        df = supplier.search_supplier_items()
        numeric_cols = df.select_dtypes(include=['float64', 'float32', 'int64', 'int32']).columns
        df[numeric_cols] = df[numeric_cols].fillna(0)
        return df.to_dict(orient="records")
    except Exception as e:
        handle_db_error(e)

@app.post("/api/suppliers")
def create_supplier_item(body: SupplierItemCreate):
    try:
        supplier.add_supplier_item(
            item_id=body.item_id,
            supplier_id=body.supplier_id,
            given_leadtime=body.given_leadtime,
            given_leadtime_deviation=body.given_leadtime_deviation,
            lot_size=body.lot_size,
            min_size=body.min_size,
            max_size=body.max_size,
            calculated=body.calculated,
            status=body.status
        )
        return {"status": "success"}
    except Exception as e:
        handle_db_error(e)

@app.put("/api/suppliers/update")
def update_supplier(body: SupplierItemUpdate):
    try:
        supplier.update_supplier_item(
            item_id=body.item_id,
            supplier_id=body.supplier_id,
            given_leadtime=body.given_leadtime,
            given_leadtime_deviation=body.given_leadtime_deviation,
            lot_size=body.lot_size,
            min_size=body.min_size,
            max_size=body.max_size,
            calculated=body.calculated,
            status=body.status
        )
        return {"status": "success"}
    except Exception as e:
        handle_db_error(e)

# ---------------------------------------------------------
# 4. Stock Movement (refactored)
# ---------------------------------------------------------
@app.get("/api/stock-movements")
def get_stock_movements():
    try:
        # Default limit is 100 in crud
        df = stock.search_stock_movements(limit=100)
        return df.to_dict(orient="records")
    except Exception as e:
        handle_db_error(e)

@app.post("/api/stock-movements")
def create_stock_movement(body: StockMovementCreate):
    try:
        stock.add_stock_movement(
            item_id=body.item_id,
            amount=body.amount,
            purpose=body.purpose,
            date=body.date,
            order_id=body.order_id
        )
        return {"status": "success"}
    except Exception as e:
        handle_db_error(e)

# ---------------------------------------------------------
# 5. Inventory (Active Inventory) (refactored)
# ---------------------------------------------------------
@app.get("/api/inventory")
def get_inventory():
    try:
        df = stock.get_inventory_with_details()
        return df.fillna("").to_dict(orient="records")
    except Exception as e:
        handle_db_error(e)

@app.put("/api/inventory/update")
def update_inventory(body: InventoryUpdate):
    try:
        stock.update_active_inventory_amount(body.item_id, body.amount)
        return {"status": "success"}
    except Exception as e:
        handle_db_error(e)

# ---------------------------------------------------------
# 6. Orders (Purchase) (refactored)
# ---------------------------------------------------------
@app.get("/api/orders")
def get_orders():
    try:
        df = purchase.get_orders()
        return df.fillna("").to_dict(orient="records")
    except Exception as e:
        handle_db_error(e)

@app.post("/api/orders")
def create_order_endpoint(body: OrderCreate):
    try:
        purchase.create_order(
            item_id=body.item_id,
            supplier_id=body.supplier_id,
            amount=body.amount,
            purpose=body.purpose,
            purchase_date=body.purchase_date,
            expected_coming_date=body.expected_coming_date
        )
        return {"status": "success"}
    except Exception as e:
        handle_db_error(e)

@app.delete("/api/orders/{order_id}")
def delete_order_endpoint(order_id: int):
    try:
        purchase.delete_order(order_id)
        return {"status": "success"}
    except Exception as e:
        handle_db_error(e)

@app.put("/api/orders/receive")
def receive_order_endpoint(body: OrderUpdate):
    try:
        purchase.receive_order(body.id, body.actual_coming_date)
        return {"status": "success"}
    except Exception as e:
        handle_db_error(e)

@app.put("/api/orders/update")
def edit_order_endpoint(body: OrderEdit):
    try:
        purchase.update_order(
            order_id=body.id,
            item_id=body.item_id,
            supplier_id=body.supplier_id,
            amount=body.amount,
            purpose=body.purpose,
            purchase_date=body.purchase_date,
            expected_coming_date=body.expected_coming_date
        )
        return {"status": "success"}
    except Exception as e:
        handle_db_error(e)

# ---------------------------------------------------------
# 7. Demand Forecast
# ---------------------------------------------------------
from backend.crud import forecast

@app.get("/api/forecast/temporary")
def get_forecast():
    try:
        df = forecast.get_forecast_data()
        if not df.empty and 'date' in df.columns:
            df['date'] = df['date'].astype(str)
            
        return df.fillna("").to_dict(orient="records")
    except Exception as e:
        handle_db_error(e)

@app.put("/api/forecast/update")
def update_forecast_row(body: ForecastUpdate):
    try:
        forecast.update_forecast_data(body.item_id, body.date, body.amount)
        return {"status": "success"}
    except Exception as e:
        handle_db_error(e)

@app.post("/api/forecast/calculate")
def calculate_forecast():
    try:
        prophet.run_full_analysis()

        return {"status": "success", "message": "Calculation completed."}
    except Exception as e:
        handle_db_error(e)

@app.post("/api/forecast/approve")
def approve_forecast():
    try:
        # Prophet logic transfer
        from backend.database.db_helper import run_command
        sql_transfer = """
        INSERT INTO prophet_table_history (item_id, date, amount)
        SELECT item_id, date, amount FROM prophet_table_temporary
        ON CONFLICT (item_id, date) DO NOTHING;
        """
        run_command(sql_transfer)
        return {"status": "success"}
    except Exception as e:
        handle_db_error(e)


# ---------------------------------------------------------
# 8. Sales History (Optional / Dead Code?)
# ---------------------------------------------------------
# Kullanıcı isteği: Sadece main ve crud kullanılacak, sales.py silindi.
# Eğer frontend sales tablosu istiyorsa, sales_out_history üzerinden okuyabiliriz.
# Ama yazma işlemi stock_movement trigger ile oluyor.
# Manuel sales ekleme (stock movement harici) isteniyorsa:
@app.get("/api/sales")
def get_sales():
    try:
        df = stock.get_all_sales_records()
        if not df.empty and 'date' in df.columns:
            df['date'] = df['date'].astype(str)
        return df.fillna("").to_dict(orient="records")
    except Exception as e:
        handle_db_error(e)

@app.post("/api/sales")
def create_sale(body: SalesRecordCreate):
    try:
        stock.add_sales_record(body.item_id, body.amount, body.date)
        return {"status": "success"}
    except Exception as e:
        handle_db_error(e)

@app.put("/api/sales/{record_id}")
def update_sale(record_id: int, body: SalesRecordUpdate):
    try:
        stock.update_sales_record(record_id, body.amount, body.date)
        return {"status": "success"}
    except Exception as e:
        handle_db_error(e)

@app.delete("/api/sales/{record_id}")
def delete_sale(record_id: int):
    try:
        stock.delete_sales_record(record_id)
        return {"status": "success"}
    except Exception as e:
        handle_db_error(e)


# ---------------------------------------------------------
# 9. Safety Stock AI (refactored)
# ---------------------------------------------------------
@app.get("/api/safety-stock")
def get_safety_stock():
    try:
        current_month_start = date.today().replace(day=1).strftime("%Y-%m-%d")
        df_final = safety_stock.get_final_safety_stock(current_month_start)
        
        if not df_final.empty:
             if 'date' in df_final.columns:
                df_final['date'] = df_final['date'].astype(str)

        df_inv = stock.get_current_stock_dataframe() # Need this func in stock.py or just use get_inventory_with_details
        # stock.get_inventory_with_details gives more info, let's use that
        df_inv = stock.get_inventory_with_details()[['item_id', 'amount']] # rename 'amount' to 'current_stock'
        df_inv.rename(columns={'amount': 'current_stock'}, inplace=True)
       
        if not df_final.empty:
            df_merged = df_final.merge(df_inv, on='item_id', how='left')
            df_merged['current_stock'] = df_merged['current_stock'].fillna(0)
            
            df_merged['safety_stock'] = df_merged['safety_stock'].astype(float)
            df_merged['current_stock'] = df_merged['current_stock'].astype(float)
            
            df_merged['stock_difference'] = df_merged['current_stock'] - df_merged['safety_stock']
            
            return df_merged.to_dict(orient="records")
            
        return []
    except Exception as e:
        handle_db_error(e)

@app.get("/api/safety-stock/temporary")
def get_safety_stock_temporary():
    try:
        df_ai = safety_stock.get_calculated_safety_stock_temp()
        if not df_ai.empty and 'date' in df_ai.columns:
            df_ai['date'] = df_ai['date'].astype(str)
            
        df_formula = safety_stock.get_kings_formula_results()
        
        if not df_ai.empty:
            df_merged = df_ai.merge(df_formula, on='item_id', how='left')
            df_merged['formula_result'] = df_merged['formula_result'].fillna(0).round(2)
            
            df_inv = stock.get_inventory_with_details()[['item_id', 'amount']]
            df_inv.rename(columns={'amount': 'current_stock'}, inplace=True)

            df_merged = df_merged.merge(df_inv, on='item_id', how='left')
            df_merged['current_stock'] = df_merged['current_stock'].fillna(0)
            
            return df_merged.to_dict(orient="records")
            
        return []
    except Exception as e:
        handle_db_error(e)

@app.post("/api/safety-stock/calculate")
def calculate_safety_stock_endpoint():
    try:
        safety_stock.calculate_safety_stock()
        return {"status": "success"}
    except Exception as e:
        handle_db_error(e)

@app.post("/api/safety-stock/approve")
def approve_safety_stock(approval_list: List[ApprovalItem]):
    try:
        count = safety_stock.approve_safety_stock_plan(approval_list)
        return {"status": "success", "count": count}
    except Exception as e:
        handle_db_error(e)

# ---------------------------------------------------------
# 12. Customer Orders (refactored)
# ---------------------------------------------------------
@app.get("/api/customer-orders")
def get_customer_orders_api():
    try:
        return customer_orders.get_customer_orders()
    except Exception as e:
        handle_db_error(e)

@app.post("/api/customer-orders")
def create_customer_order_api(body: CustomerOrderCreate):
    try:
        return customer_orders.create_customer_order(body)
    except Exception as e:
        handle_db_error(e)

@app.put("/api/customer-orders/{order_id}")
def update_customer_order_api(order_id: int, body: CustomerOrderUpdate):
    try:
        return customer_orders.update_customer_order(order_id, body)
    except Exception as e:
        handle_db_error(e)

@app.delete("/api/customer-orders/{order_id}")
def delete_customer_order_api(order_id: int):
    try:
        customer_orders.delete_customer_order(order_id)
        return {"status": "success"}
    except Exception as e:
        handle_db_error(e)

# ---------------------------------------------------------
# 13. Simulation (Order Map)
# ---------------------------------------------------------
@app.get("/api/simulation/suggestions")
def get_simulation_suggestions_api():
    try:
        return sim_manager.get_simulation_suggestions()
    except Exception as e:
        handle_db_error(e)

@app.post("/api/simulation/reset")
def reset_simulation_api():
    try:
        sim_manager.initialize_simulation_table()
        return {"status": "success"}
    except Exception as e:
        handle_db_error(e)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
