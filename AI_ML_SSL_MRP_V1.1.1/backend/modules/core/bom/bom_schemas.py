from pydantic import BaseModel, Field
from typing import Optional


class BomCreate(BaseModel):
    parent_id: str
    child_id: str
    amount: float = Field(..., gt=0)
    activity_status: str


class BomUpdate(BaseModel):
    amount: Optional[float] = Field(None, gt=0)
    activity_status: Optional[str] = None
