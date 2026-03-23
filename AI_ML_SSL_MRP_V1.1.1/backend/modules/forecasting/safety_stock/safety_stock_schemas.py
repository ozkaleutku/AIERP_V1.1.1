from pydantic import BaseModel
from typing import List

class ApprovalItem(BaseModel):
    item_id: str
    date: str
    amount: float
    item_quantity_type: str
    preference: str

class SafetyStockApprovalPlan(BaseModel):
    items: List[ApprovalItem]
