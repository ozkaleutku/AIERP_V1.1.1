from pydantic import BaseModel
from typing import Optional

class SupplierItemCreate(BaseModel):
    item_id: str
    supplier_id: str
    amount: float
    given_leadtime: int
    activity_status: str

class SupplierItemUpdate(BaseModel):
    amount: Optional[float] = None
    given_leadtime: Optional[int] = None
    calculated: Optional[bool] = None
    activity_status: Optional[str] = None
