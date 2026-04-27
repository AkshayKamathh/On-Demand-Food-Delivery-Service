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
    trip_id: Optional[int] = None
    robot_name: Optional[str] = None
    trip_stop_sequence: Optional[int] = None
    trip_total_stops: Optional[int] = None
    trip_status: Optional[str] = None
    trip_current_stop: Optional[int] = None


class OrderDeliveredResponse(BaseModel):
    order_id: int
    status: str
    delivered_at: datetime


class OrderCancelResponse(BaseModel):
    order_id: int
    status: str


VALID_ORDER_STATUSES = {
    "pending_payment",
    "submitted",
    "preparing",
    "out_for_delivery",
    "delivered",
    "cancelled",
}


class ManagerOrderListItem(BaseModel):
    id: int
    created_at: datetime
    total: float
    status: str
    recipient_name: str
    email: str
    delivery_address: str


class OrderStatusUpdate(BaseModel):
    status: str


class OrderStatusUpdateResponse(BaseModel):
    order_id: int
    status: str

