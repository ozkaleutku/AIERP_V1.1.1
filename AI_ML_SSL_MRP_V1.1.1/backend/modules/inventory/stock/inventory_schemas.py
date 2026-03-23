from pydantic import BaseModel
from typing import Optional

class InventoryUpdate(BaseModel):
    current_stock: float

class LocationResponse(BaseModel):
    id: str
    name: str
    type: str
