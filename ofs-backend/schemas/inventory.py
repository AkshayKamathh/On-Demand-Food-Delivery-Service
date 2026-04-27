from pydantic import BaseModel
from typing import Optional

#Returned when we GET an inventory item
class InventoryItem(BaseModel):
    sku: str
    name: str
    category: str
    price: float
    weight_lb: float
    stock: int
    status: str
    image_url: Optional[str] = None

#Used when we PATCH an inventory item
class InventoryUpdate(BaseModel):
    #Optional fields so we can PATCH only what changes
    price: Optional[float] = None
    stock: Optional[int] = None
    image_url: Optional[str] = None

#Use when we POST a new inventory item
class InventoryCreate(BaseModel):
    name: str
    category: str
    price: float
    weight_lb: float
    stock: int
    image_url: Optional[str] = None
