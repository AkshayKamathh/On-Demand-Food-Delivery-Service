from pydantic import BaseModel, Field
from typing import Optional

class CartItemBase(BaseModel):
    item_id: int
    quantity: int = Field(gt=0)

class CartItemCreate(CartItemBase):
    pass

class CartItemUpdate(BaseModel):
    quantity: int = Field(gt=0)

class CartItem(BaseModel):
    id: int
    item_id: int
    quantity: int
    description: str
    price: float
    weight: float
    image_url: Optional[str] = None
