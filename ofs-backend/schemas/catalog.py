from pydantic import BaseModel
from typing import Optional, Dict, Any

class Product(BaseModel):
    item_id: int
    description: str
    category_id: Optional[int] = None
    price: float
    weight: float
    stock: int
    image_url: Optional[str] = None

class ProductDetail(BaseModel):
    item_id: int
    description: str
    category_id: Optional[int] = None
    price: float
    weight: float
    stock: int
    image_url: Optional[str] = None
    long_description: Optional[str] = None
    nutrition: Optional[Dict[str, Any]] = None
    extra: Optional[Dict[str, Any]] = None
