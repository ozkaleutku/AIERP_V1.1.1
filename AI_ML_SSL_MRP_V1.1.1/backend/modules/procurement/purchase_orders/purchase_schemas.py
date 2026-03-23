from pydantic import BaseModel
from typing import Optional
from datetime import date

class OrderCreate(BaseModel):
    item_id: str
    supplier_id: str
    amount: float
    unit_price: float
    currency: Optional[str] = "TRY"
    expected_coming_date: Optional[date] = None

class OrderEdit(BaseModel):
    supplier_id: Optional[str] = None
    amount: Optional[float] = None
    expected_coming_date: Optional[date] = None

class OrderUpdate(BaseModel):
    status: str
    actual_coming_date: Optional[date] = None
    unit_price: Optional[float] = None
    amount: Optional[float] = None
