from pydantic import BaseModel
from typing import Any, Dict, Optional

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
    is_active: bool = True
    long_description: Optional[str] = None
    nutrition: Optional[Dict[str, Any]] = None

#Used when we PATCH an inventory item
class InventoryUpdate(BaseModel):
    #Optional fields so we can PATCH only what changes
    name: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    weight_lb: Optional[float] = None
    stock: Optional[int] = None
    image_url: Optional[str] = None
    is_active: Optional[bool] = None
    long_description: Optional[str] = None
    nutrition: Optional[Dict[str, Any]] = None

#Use when we POST a new inventory item
class InventoryCreate(BaseModel):
    name: str
    category: str
    price: float
    weight_lb: float
    stock: int
    image_url: Optional[str] = None
