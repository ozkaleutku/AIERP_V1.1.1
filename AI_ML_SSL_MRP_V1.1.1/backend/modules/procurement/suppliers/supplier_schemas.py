from pydantic import BaseModel
from typing import Optional

class SupplierItemCreate(BaseModel):
    item_id: str
    supplier_id: str
    given_leadtime: float
    given_leadtime_deviation: Optional[float] = 0.0
    lot_size: Optional[float] = 0.0
    min_size: Optional[float] = 0.0
    max_size: Optional[float] = 0.0
    calculated: Optional[bool] = False
    activity_status: Optional[str] = "Aktif"
    status: Optional[str] = None

class SupplierItemUpdate(BaseModel):
    item_id: Optional[str] = None
    supplier_id: Optional[str] = None
    given_leadtime: Optional[float] = None
    given_leadtime_deviation: Optional[float] = None
    lot_size: Optional[float] = None
    min_size: Optional[float] = None
    max_size: Optional[float] = None
    calculated: Optional[bool] = None
    activity_status: Optional[str] = None
    status: Optional[str] = None
