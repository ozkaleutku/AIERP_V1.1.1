from pydantic import BaseModel
from typing import List

class ForecastUpdate(BaseModel):
    item_id: str
    date: str
    amount: float

class ForecastApprovalItem(BaseModel):
    item_id: str
    date: str
    
class ForecastApprovalBulk(BaseModel):
    items: List[ForecastApprovalItem]
