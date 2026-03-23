from pydantic import BaseModel
from datetime import date
from typing import Optional

class StockMovementCreate(BaseModel):
    item_id: str
    target_location_id: str
    amount: float
    purpose: str
    date: date
    order_id: Optional[int] = None
