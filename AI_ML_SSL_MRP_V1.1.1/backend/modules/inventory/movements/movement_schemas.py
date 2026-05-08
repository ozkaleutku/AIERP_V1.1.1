from pydantic import BaseModel
from datetime import date
from typing import Optional

class StockMovementCreate(BaseModel):
    item_id: str
    amount: float
    purpose: str
    date: date
    order_id: Optional[int] = None
    source_location_id: Optional[str] = None
    target_location_id: Optional[str] = None
    tracking_code: Optional[str] = None
    parent_id: Optional[int] = None
    is_completed: Optional[bool] = False
