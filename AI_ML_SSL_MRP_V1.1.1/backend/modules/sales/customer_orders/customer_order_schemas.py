from pydantic import BaseModel
from typing import Optional
from datetime import date

class CustomerOrderCreate(BaseModel):
    customer_name: str
    item_id: str
    amount: float
    order_date: date
    expected_delivery_date: Optional[date] = None
    production_time_days: Optional[int] = None
    delivery_date: Optional[date] = None
    status: Optional[str] = "Bekleniyor"

class CustomerOrderUpdate(BaseModel):
    id: int
    amount: Optional[float] = None
    expected_delivery_date: Optional[date] = None
    delivery_date: Optional[date] = None
    production_time_days: Optional[int] = None
    status: Optional[str] = None

class CustomerOrderResponse(CustomerOrderCreate):
    id: int
