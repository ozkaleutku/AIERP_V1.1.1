from pydantic import BaseModel
from typing import Optional
from datetime import date

class SalesRecordCreate(BaseModel):
    item_id: str
    customer_name: Optional[str] = None
    amount: float
    date: date
    order_id: Optional[int] = None

class SalesRecordUpdate(BaseModel):
    item_id: Optional[str] = None
    customer_name: Optional[str] = None
    amount: Optional[float] = None
    date: Optional[date] = None
    order_id: Optional[int] = None
