from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr


class OrderListItem(BaseModel):
    id: int
    created_at: datetime
    total: float
    status: str


class OrderItem(BaseModel):
    item_id: int
    description: str
    quantity: int
    unit_price: float
    unit_weight: float
    line_total: float


class OrderDetail(BaseModel):
    id: int
    user_id: str
    status: str
    payment_status: str
    subtotal: float
    delivery_fee: float
    total: float
    currency: str
    recipient_name: str
    email: EmailStr
    delivery_address: str
    delivery_address_latitude: float
    delivery_address_longitude: float
    delivery_notes: Optional[str] = None
    paid_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    created_at: datetime
    items: List[OrderItem]


class OrderDeliveredResponse(BaseModel):
    order_id: int
    status: str
    delivered_at: datetime

