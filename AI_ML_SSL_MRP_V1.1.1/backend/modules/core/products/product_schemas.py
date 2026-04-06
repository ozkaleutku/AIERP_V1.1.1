from pydantic import BaseModel, Field
from typing import Optional


class ProductCreate(BaseModel):
    item_id: str
    item_type: str
    item_quantity_type: str
    activity_status: str
    unit_cost: Optional[float] = 0
    unit_price: Optional[float] = 0
    additional_cost: Optional[float] = 0
    currency: Optional[str] = 'TRY'
    production_time_value: Optional[float] = 0
    production_time_unit: Optional[str] = 'saat'


class ProductUpdate(BaseModel):
    activity_status: Optional[str] = None
    item_type: Optional[str] = None
    item_quantity_type: Optional[str] = None
    unit_cost: Optional[float] = None
    unit_price: Optional[float] = None
    additional_cost: Optional[float] = None
    currency: Optional[str] = None
    production_time_value: Optional[float] = None
    production_time_unit: Optional[str] = None
