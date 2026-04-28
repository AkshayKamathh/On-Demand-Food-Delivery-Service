from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


class AddressSuggestion(BaseModel):
    label: str
    address: str
    latitude: float
    longitude: float


class AddressSearchResponse(BaseModel):
    suggestions: List[AddressSuggestion]


class AddressValidationRequest(BaseModel):
    address: str = Field(min_length=5, max_length=500)


class ValidatedAddress(BaseModel):
    address: str
    latitude: float
    longitude: float


class CheckoutItem(BaseModel):
    item_id: int
    description: str
    quantity: int
    price: float
    weight: float
    line_total: float


class CheckoutSessionCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    address: str = Field(min_length=5, max_length=500)
    delivery_notes: Optional[str] = Field(default=None, max_length=500)


class CheckoutSessionResponse(BaseModel):
    order_id: int
    checkout_url: str


class CheckoutConfirmRequest(BaseModel):
    order_id: int
    session_id: str = Field(min_length=1)


class CheckoutSummary(BaseModel):
    items: List[CheckoutItem]
    subtotal: float
    delivery_fee: float
    total: float
    total_weight: float


class OrderConfirmationResponse(BaseModel):
    order_id: int
    status: str
    payment_status: str
    total: float


class LastOrderAddressResponse(BaseModel):
    recipient_name: str
    delivery_address: str
    delivery_address_latitude: float
    delivery_address_longitude: float
    delivery_notes: Optional[str] = None