from pydantic import BaseModel
from typing import Optional

class InventoryUpdate(BaseModel):
    current_stock: Optional[float] = None
    amount: Optional[float] = None
    item_id: Optional[str] = None

class LocationResponse(BaseModel):
    id: str
    name: str
    type: str
