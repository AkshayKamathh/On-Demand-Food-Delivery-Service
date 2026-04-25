from datetime import datetime
from typing import List, Optional, Tuple

from pydantic import BaseModel


CAPACITY_ORDERS = 10
CAPACITY_WEIGHT_LBS = 200.0

VALID_TRIP_STATUSES = {"planned", "in_progress", "completed", "cancelled"}
VALID_ROBOT_STATUSES = {"idle", "dispatched", "offline"}


class LegPlan(BaseModel):
    coordinates: List[List[float]]  # [[lng, lat], ...]
    duration_s: float
    distance_m: float


class TripStateStop(BaseModel):
    stop_sequence: int
    order_id: int
    recipient_name: str
    delivery_address: str
    longitude: float
    latitude: float
    delivered: bool
    delivered_at: Optional[datetime] = None


class TripState(BaseModel):
    trip_id: int
    robot_id: int
    robot_name: str
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    server_now: datetime
    speed_multiplier: float
    legs: List[LegPlan]
    stops: List[TripStateStop]
    current_stop: int
    order_count: int


class CustomerStopMarker(BaseModel):
    stop_sequence: int
    longitude: float
    latitude: float
    is_you: bool


class CustomerTripView(BaseModel):
    trip_id: int
    robot_name: str
    status: str
    started_at: Optional[datetime] = None
    server_now: datetime
    speed_multiplier: float
    legs: List[LegPlan]
    stops: List[CustomerStopMarker]
    your_stop_sequence: int
    order_count: int
    restaurant_lng: float
    restaurant_lat: float


class ReadyOrder(BaseModel):
    order_id: int
    recipient_name: str
    delivery_address: str
    latitude: float
    longitude: float
    weight: float
    total: float
    created_at: datetime


class ReadyDispatchSummary(BaseModel):
    orders: List[ReadyOrder]
    total_weight: float
    order_count: int


class RobotSummary(BaseModel):
    id: int
    name: str
    status: str
    current_trip_id: Optional[int] = None


class TripStop(BaseModel):
    stop_sequence: int
    order_id: int
    recipient_name: str
    delivery_address: str
    latitude: float
    longitude: float
    weight: float
    delivered: bool


class TripSummary(BaseModel):
    id: int
    robot_id: int
    robot_name: str
    status: str
    order_count: int
    total_weight: float
    current_stop: int
    route_optimized: bool
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime


class TripDetail(TripSummary):
    stops: List[TripStop]


class DispatchRunResponse(BaseModel):
    trips: List[TripSummary]
    skipped_overweight_order_ids: List[int]
    deferred_order_count: int
    message: str


class TripStatusUpdate(BaseModel):
    status: str


class TripStatusUpdateResponse(BaseModel):
    trip_id: int
    status: str


class TripAdvanceResponse(BaseModel):
    trip_id: int
    current_stop: int
    status: str
    delivered_order_id: Optional[int] = None
