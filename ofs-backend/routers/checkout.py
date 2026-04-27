import os
import json
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional
from urllib.parse import quote
from uuid import UUID

import math
import requests
import stripe
from fastapi import APIRouter, Depends, HTTPException, Query

from db import get_db
from deps import get_current_user_id
from routers.dispatch import (
    SIMULATION_SPEED,
    _parse_legs,
    _reconcile_trip_progress,
)
from schemas.checkout import (
    AddressSearchResponse,
    AddressSuggestion,
    AddressValidationRequest,
    CheckoutConfirmRequest,
    CheckoutItem,
    CheckoutSessionCreate,
    CheckoutSessionResponse,
    CheckoutSummary,
    LastOrderAddressResponse,
    OrderConfirmationResponse,
    ValidatedAddress,
)
from schemas.dispatch import CustomerStopMarker, CustomerTripView, LegPlan
from schemas.orders import OrderDeliveredResponse, OrderDetail, OrderItem, OrderListItem

router = APIRouter(prefix="/checkout", tags=["checkout"])

MAPBOX_ACCESS_TOKEN = os.getenv("MAPBOX_ACCESS_TOKEN")
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000")
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY


START_ADDRESS_LABEL = "188 North 6th Street, San Jose, California 95112, United States"
# Coordinates for the start point. (lng, lat)
# If you want perfect accuracy, swap these with Mapbox-geocoded values once.
START_LNG = -121.8950
START_LAT = 37.3497


def as_money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def delivery_fee_for_weight(total_weight: Decimal) -> Decimal:
    return Decimal("0.00") if total_weight <= Decimal("20") else Decimal("10.00")


def serialize_decimal(value: Decimal) -> float:
    return float(as_money(value))


def mapbox_forward_geocode(address: str, *, autocomplete: bool, limit: int) -> List[Dict[str, Any]]:
    if not MAPBOX_ACCESS_TOKEN:
        raise HTTPException(status_code=500, detail="MAPBOX_ACCESS_TOKEN is not set")

    encoded_query = quote(address)
    response = requests.get(
        f"https://api.mapbox.com/geocoding/v5/mapbox.places/{encoded_query}.json",
        params={
            "access_token": MAPBOX_ACCESS_TOKEN,
            "country": "us",
            "limit": limit,
            "autocomplete": "true" if autocomplete else "false",
            "types": "address,place,postcode",
        },
        timeout=10,
    )
    response.raise_for_status()
    payload = response.json()
    return payload.get("features", [])


def validate_delivery_address(address: str) -> ValidatedAddress:
    features = mapbox_forward_geocode(address, autocomplete=False, limit=1)
    if not features:
        raise HTTPException(status_code=400, detail="Unable to validate delivery address")

    feature = features[0]
    center = feature.get("center") or [None, None]
    longitude, latitude = center[0], center[1]
    if longitude is None or latitude is None:
        raise HTTPException(status_code=400, detail="Validated address is missing coordinates")

    return ValidatedAddress(
        address=feature.get("place_name") or address.strip(),
        latitude=float(latitude),
        longitude=float(longitude),
    )


def load_cart_snapshot(cur, user_id: UUID) -> List[Dict[str, Any]]:
    cur.execute(
        """
        SELECT
          ci.item_id,
          ci.quantity,
          i.description,
          i.price,
          i.weight,
          i.stock,
          i.image_url
        FROM public.cart_items ci
        JOIN public.items i ON i.item_id = ci.item_id
        WHERE ci.user_id = %(uid)s
        ORDER BY ci.id
        """,
        {"uid": str(user_id)},
    )
    rows = cur.fetchall()
    if not rows:
        raise HTTPException(status_code=400, detail="Cart is empty")

    for row in rows:
        stock = int(row["stock"] or 0)
        quantity = int(row["quantity"] or 0)
        if quantity <= 0:
            raise HTTPException(status_code=400, detail="Cart contains an invalid quantity")
        if stock < quantity:
            raise HTTPException(
                status_code=409,
                detail=f"Insufficient stock for '{row['description']}'",
            )

    return rows


def build_checkout_summary(cart_rows: List[Dict[str, Any]]) -> CheckoutSummary:
    items: List[CheckoutItem] = []
    subtotal = Decimal("0.00")
    total_weight = Decimal("0.00")

    for row in cart_rows:
        quantity = Decimal(str(row["quantity"]))
        price = Decimal(str(row["price"] or 0))
        weight = Decimal(str(row["weight"] or 0))
        line_total = as_money(price * quantity)
        subtotal += line_total
        total_weight += weight * quantity
        items.append(
            CheckoutItem(
                item_id=int(row["item_id"]),
                description=row["description"],
                quantity=int(row["quantity"]),
                price=serialize_decimal(price),
                weight=float(weight),
                line_total=serialize_decimal(line_total),
            )
        )

    delivery_fee = delivery_fee_for_weight(total_weight)
    total = as_money(subtotal + delivery_fee)
    return CheckoutSummary(
        items=items,
        subtotal=serialize_decimal(subtotal),
        delivery_fee=serialize_decimal(delivery_fee),
        total=serialize_decimal(total),
        total_weight=float(total_weight),
    )


def require_stripe() -> None:
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="STRIPE_SECRET_KEY is not set")


def mapbox_directions_eta_seconds(*, start_lng: float, start_lat: float, end_lng: float, end_lat: float) -> int:
    if not MAPBOX_ACCESS_TOKEN:
        raise HTTPException(status_code=500, detail="MAPBOX_ACCESS_TOKEN is not set")

    response = requests.get(
        f"https://api.mapbox.com/directions/v5/mapbox/driving/{start_lng},{start_lat};{end_lng},{end_lat}",
        params={
            "access_token": MAPBOX_ACCESS_TOKEN,
            "geometries": "geojson",
            "overview": "simplified",
        },
        timeout=10,
    )
    response.raise_for_status()
    payload = response.json()
    routes = payload.get("routes") or []
    if not routes:
        return 0
    duration = routes[0].get("duration") or 0
    return int(duration)


@router.get("/address/search", response_model=AddressSearchResponse)
def search_delivery_addresses(q: str = Query(..., min_length=3, max_length=200)):
    try:
        features = mapbox_forward_geocode(q, autocomplete=True, limit=5)
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Mapbox address lookup failed")

    suggestions: List[AddressSuggestion] = []
    for feature in features:
        center = feature.get("center") or [None, None]
        longitude, latitude = center[0], center[1]
        if longitude is None or latitude is None:
            continue
        suggestions.append(
            AddressSuggestion(
                label=feature.get("place_name") or feature.get("text") or q,
                address=feature.get("place_name") or q,
                latitude=float(latitude),
                longitude=float(longitude),
            )
        )

    return AddressSearchResponse(suggestions=suggestions)


@router.post("/address/validate", response_model=ValidatedAddress)
def validate_address(payload: AddressValidationRequest):
    try:
        return validate_delivery_address(payload.address)
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Mapbox address validation failed")


@router.get("/summary", response_model=CheckoutSummary)
def get_checkout_summary(user_id: UUID = Depends(get_current_user_id)):
    with get_db() as (conn, cur):
        rows = load_cart_snapshot(cur, user_id)
    return build_checkout_summary(rows)


@router.get("/last-order-address", response_model=Optional[LastOrderAddressResponse])
def get_last_order_address(user_id: UUID = Depends(get_current_user_id)):
    with get_db() as (conn, cur):
        cur.execute(
            """
            SELECT recipient_name, delivery_address,
                   delivery_address_latitude, delivery_address_longitude,
                   delivery_notes
            FROM public.orders
            WHERE user_id = %(user_id)s
              AND payment_status = 'paid'
            ORDER BY created_at DESC, id DESC
            LIMIT 1
            """,
            {"user_id": str(user_id)},
        )
        row = cur.fetchone()

    if not row:
        return None

    return LastOrderAddressResponse(
        recipient_name=row["recipient_name"],
        delivery_address=row["delivery_address"],
        delivery_address_latitude=float(row["delivery_address_latitude"]),
        delivery_address_longitude=float(row["delivery_address_longitude"]),
        delivery_notes=row.get("delivery_notes"),
    )


@router.post("/session", response_model=CheckoutSessionResponse)
def create_checkout_session(
    payload: CheckoutSessionCreate,
    user_id: UUID = Depends(get_current_user_id),
):
    require_stripe()

    try:
        validated_address = validate_delivery_address(payload.address)
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Mapbox address validation failed")

    with get_db() as (conn, cur):
        cart_rows = load_cart_snapshot(cur, user_id)
        summary = build_checkout_summary(cart_rows)

        cur.execute(
            """
            INSERT INTO public.orders (
              user_id,
              status,
              payment_status,
              subtotal,
              delivery_fee,
              total,
              recipient_name,
              email,
              delivery_address,
              delivery_address_latitude,
              delivery_address_longitude,
              delivery_notes
            )
            VALUES (
              %(user_id)s,
              'pending_payment',
              'unpaid',
              %(subtotal)s,
              %(delivery_fee)s,
              %(total)s,
              %(recipient_name)s,
              %(email)s,
              %(delivery_address)s,
              %(latitude)s,
              %(longitude)s,
              %(delivery_notes)s
            )
            RETURNING id
            """,
            {
                "user_id": str(user_id),
                "subtotal": summary.subtotal,
                "delivery_fee": summary.delivery_fee,
                "total": summary.total,
                "recipient_name": payload.full_name.strip(),
                "email": payload.email,
                "delivery_address": validated_address.address,
                "latitude": validated_address.latitude,
                "longitude": validated_address.longitude,
                "delivery_notes": payload.delivery_notes.strip() if payload.delivery_notes else None,
            },
        )
        order_row = cur.fetchone()
        order_id = int(order_row["id"])

        for item in summary.items:
            cur.execute(
                """
                INSERT INTO public.order_items (
                  order_id,
                  item_id,
                  description,
                  quantity,
                  unit_price,
                  unit_weight,
                  line_total
                )
                VALUES (
                  %(order_id)s,
                  %(item_id)s,
                  %(description)s,
                  %(quantity)s,
                  %(unit_price)s,
                  %(unit_weight)s,
                  %(line_total)s
                )
                """,
                {
                    "order_id": order_id,
                    "item_id": item.item_id,
                    "description": item.description,
                    "quantity": item.quantity,
                    "unit_price": item.price,
                    "unit_weight": item.weight,
                    "line_total": item.line_total,
                },
            )

        success_url = (
            f"{FRONTEND_BASE_URL}/checkout?status=success&order_id={order_id}"
            "&session_id={CHECKOUT_SESSION_ID}"
        )
        cancel_url = f"{FRONTEND_BASE_URL}/checkout?status=cancelled&order_id={order_id}"

        line_items: List[Dict[str, Any]] = []
        for row in cart_rows:
            unit_amount = int(
                (as_money(Decimal(str(row["price"] or 0))) * Decimal("100")).to_integral_value()
            )
            line_items.append(
                {
                    "price_data": {
                        "currency": "usd",
                        "product_data": {
                            "name": row["description"],
                        },
                        "unit_amount": unit_amount,
                    },
                    "quantity": int(row["quantity"]),
                }
            )

        if summary.delivery_fee > 0:
            line_items.append(
                {
                    "price_data": {
                        "currency": "usd",
                        "product_data": {
                            "name": "Delivery fee",
                        },
                        "unit_amount": int(Decimal(str(summary.delivery_fee)) * Decimal("100")),
                    },
                    "quantity": 1,
                }
            )

        session = stripe.checkout.Session.create(
            mode="payment",
            line_items=line_items,
            success_url=success_url,
            cancel_url=cancel_url,
            customer_email=payload.email,
            metadata={
                "order_id": str(order_id),
                "user_id": str(user_id),
            },
        )

        cur.execute(
            """
            UPDATE public.orders
            SET stripe_checkout_session_id = %(session_id)s
            WHERE id = %(order_id)s
            """,
            {
                "session_id": session.id,
                "order_id": order_id,
            },
        )
        conn.commit()

    return CheckoutSessionResponse(order_id=order_id, checkout_url=session.url)


@router.post("/confirm", response_model=OrderConfirmationResponse)
def confirm_checkout(
    payload: CheckoutConfirmRequest,
    user_id: UUID = Depends(get_current_user_id),
):
    require_stripe()

    with get_db() as (conn, cur):
        cur.execute(
            """
            SELECT id, status, payment_status, total, stripe_checkout_session_id
            FROM public.orders
            WHERE id = %(order_id)s AND user_id = %(user_id)s
            """,
            {
                "order_id": payload.order_id,
                "user_id": str(user_id),
            },
        )
        order = cur.fetchone()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        if order["payment_status"] == "paid":
            return OrderConfirmationResponse(
                order_id=int(order["id"]),
                status=order["status"],
                payment_status=order["payment_status"],
                total=float(order["total"]),
            )

        if order["stripe_checkout_session_id"] != payload.session_id:
            raise HTTPException(status_code=400, detail="Checkout session mismatch")

        session = stripe.checkout.Session.retrieve(payload.session_id)
        if session.payment_status != "paid" or session.status != "complete":
            raise HTTPException(status_code=409, detail="Payment has not completed")

        cur.execute(
            """
            SELECT item_id, quantity
            FROM public.order_items
            WHERE order_id = %(order_id)s
            ORDER BY id
            """,
            {"order_id": payload.order_id},
        )
        order_items = cur.fetchall()

        for item in order_items:
            cur.execute(
                """
                SELECT stock
                FROM public.items
                WHERE item_id = %(item_id)s
                FOR UPDATE
                """,
                {"item_id": item["item_id"]},
            )
            inventory_row = cur.fetchone()
            if not inventory_row:
                raise HTTPException(status_code=409, detail="An ordered item no longer exists")

            stock = int(inventory_row["stock"] or 0)
            if stock < int(item["quantity"]):
                raise HTTPException(status_code=409, detail="Inventory changed before order confirmation")

            cur.execute(
                """
                UPDATE public.items
                SET stock = stock - %(quantity)s
                WHERE item_id = %(item_id)s
                """,
                {
                    "quantity": int(item["quantity"]),
                    "item_id": item["item_id"],
                },
            )

        cur.execute(
            """
            UPDATE public.orders
            SET
              status = 'preparing',
              payment_status = 'paid',
              stripe_payment_intent_id = %(payment_intent_id)s,
              paid_at = now(),
              updated_at = now()
            WHERE id = %(order_id)s
            RETURNING id, status, payment_status, total
            """,
            {
                "payment_intent_id": session.payment_intent,
                "order_id": payload.order_id,
            },
        )
        confirmed_order = cur.fetchone()

        cur.execute(
            "DELETE FROM public.cart_items WHERE user_id = %(user_id)s",
            {"user_id": str(user_id)},
        )
        conn.commit()

    return OrderConfirmationResponse(
        order_id=int(confirmed_order["id"]),
        status=confirmed_order["status"],
        payment_status=confirmed_order["payment_status"],
        total=float(confirmed_order["total"]),
    )


@router.get("/orders", response_model=List[OrderListItem])
def list_orders(user_id: UUID = Depends(get_current_user_id)):
    with get_db() as (conn, cur):
        cur.execute(
            """
            SELECT id, created_at, total, status
            FROM public.orders
            WHERE user_id = %(user_id)s
            ORDER BY created_at DESC, id DESC
            """,
            {"user_id": str(user_id)},
        )
        rows = cur.fetchall()

    return [
        OrderListItem(
            id=int(r["id"]),
            created_at=r["created_at"],
            total=float(r["total"]),
            status=r["status"],
        )
        for r in rows
    ]


@router.get("/orders/{order_id}", response_model=OrderDetail)
def get_order(order_id: int, user_id: UUID = Depends(get_current_user_id)):
    with get_db() as (conn, cur):
        # Reconcile any milestones the simulator clock has crossed for this
        # order's trip so the response reflects the live state.
        cur.execute(
            """
            SELECT t.id, t.robot_id, t.status, t.order_count, t.current_stop,
                   t.started_at, t.legs_geojson
            FROM public.delivery_trips t
            JOIN public.orders o ON o.delivery_trip_id = t.id
            WHERE o.id = %(order_id)s AND o.user_id = %(user_id)s
              AND t.status = 'in_progress'
            """,
            {"order_id": order_id, "user_id": str(user_id)},
        )
        trip_row = cur.fetchone()
        if trip_row:
            _reconcile_trip_progress(cur, trip_row)
            conn.commit()

        cur.execute(
            """
            SELECT
              o.id,
              o.user_id,
              o.status,
              o.payment_status,
              o.subtotal,
              o.delivery_fee,
              o.total,
              o.currency,
              o.recipient_name,
              o.email,
              o.delivery_address,
              o.delivery_address_latitude,
              o.delivery_address_longitude,
              o.delivery_notes,
              o.paid_at,
              o.delivered_at,
              o.created_at,
              o.delivery_trip_id,
              o.trip_stop_sequence,
              r.name AS robot_name,
              t.order_count AS trip_total_stops,
              t.status      AS trip_status,
              t.current_stop AS trip_current_stop
            FROM public.orders o
            LEFT JOIN public.delivery_trips t ON t.id = o.delivery_trip_id
            LEFT JOIN public.robots r ON r.id = t.robot_id
            WHERE o.id = %(order_id)s AND o.user_id = %(user_id)s
            """,
            {"order_id": order_id, "user_id": str(user_id)},
        )
        order = cur.fetchone()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        cur.execute(
            """
            SELECT item_id, description, quantity, unit_price, unit_weight, line_total
            FROM public.order_items
            WHERE order_id = %(order_id)s
            ORDER BY id
            """,
            {"order_id": order_id},
        )
        item_rows = cur.fetchall()

    items = [
        OrderItem(
            item_id=int(i["item_id"]),
            description=i["description"],
            quantity=int(i["quantity"]),
            unit_price=float(i["unit_price"]),
            unit_weight=float(i["unit_weight"]),
            line_total=float(i["line_total"]),
        )
        for i in item_rows
    ]

    trip_id_value = order.get("delivery_trip_id")
    trip_stop_sequence = order.get("trip_stop_sequence")
    trip_total_stops = order.get("trip_total_stops")
    trip_status = order.get("trip_status")
    trip_current_stop = order.get("trip_current_stop")

    return OrderDetail(
        id=int(order["id"]),
        user_id=str(order["user_id"]),
        status=order["status"],
        payment_status=order["payment_status"],
        subtotal=float(order["subtotal"]),
        delivery_fee=float(order["delivery_fee"]),
        total=float(order["total"]),
        currency=order["currency"],
        recipient_name=order["recipient_name"],
        email=order["email"],
        delivery_address=order["delivery_address"],
        delivery_address_latitude=float(order["delivery_address_latitude"]),
        delivery_address_longitude=float(order["delivery_address_longitude"]),
        delivery_notes=order.get("delivery_notes"),
        paid_at=order.get("paid_at"),
        delivered_at=order.get("delivered_at"),
        created_at=order["created_at"],
        items=items,
        trip_id=int(trip_id_value) if trip_id_value is not None else None,
        robot_name=order.get("robot_name"),
        trip_stop_sequence=int(trip_stop_sequence) if trip_stop_sequence is not None else None,
        trip_total_stops=int(trip_total_stops) if trip_total_stops is not None else None,
        trip_status=trip_status,
        trip_current_stop=int(trip_current_stop) if trip_current_stop is not None else None,
    )


@router.post("/orders/{order_id}/delivered", response_model=OrderDeliveredResponse)
def mark_delivered(order_id: int, user_id: UUID = Depends(get_current_user_id)):
    with get_db() as (conn, cur):
        cur.execute(
            """
            UPDATE public.orders
            SET status = 'delivered', delivered_at = now(), updated_at = now()
            WHERE id = %(order_id)s AND user_id = %(user_id)s
            RETURNING id, status, delivered_at
            """,
            {"order_id": order_id, "user_id": str(user_id)},
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Order not found")
        conn.commit()

    return OrderDeliveredResponse(
        order_id=int(row["id"]),
        status=row["status"],
        delivered_at=row["delivered_at"],
    )


@router.get("/orders/{order_id}/eta")
def get_order_eta(order_id: int, user_id: UUID = Depends(get_current_user_id)):
    """
    Real-time ETA derived from the trip simulator clock. ETA = remaining
    leg duration (down to and including the customer's stop), divided by the
    sim speed multiplier so the value is in real-world wall-clock seconds.
    """
    with get_db() as (conn, cur):
        cur.execute(
            """
            SELECT
              o.status,
              o.trip_stop_sequence,
              t.id            AS trip_id,
              t.robot_id,
              t.status        AS trip_status,
              t.current_stop  AS trip_current_stop,
              t.order_count   AS trip_total_stops,
              t.started_at    AS trip_started_at,
              t.legs_geojson
            FROM public.orders o
            LEFT JOIN public.delivery_trips t ON t.id = o.delivery_trip_id
            WHERE o.id = %(order_id)s AND o.user_id = %(user_id)s
            """,
            {"order_id": order_id, "user_id": str(user_id)},
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Order not found")

        if row.get("trip_id") and row.get("trip_status") == "in_progress":
            _reconcile_trip_progress(
                cur,
                {
                    "id": row["trip_id"],
                    "robot_id": row["robot_id"],
                    "status": row["trip_status"],
                    "order_count": row["trip_total_stops"],
                    "current_stop": row["trip_current_stop"],
                    "started_at": row["trip_started_at"],
                    "legs_geojson": row["legs_geojson"],
                },
            )
            conn.commit()

    if row["status"] == "delivered":
        return {"eta_seconds": 0, "stops_ahead": 0, "start_address": START_ADDRESS_LABEL}

    legs = _parse_legs(row.get("legs_geojson"))
    seq = row.get("trip_stop_sequence")
    started_at = row.get("trip_started_at")

    if not legs or seq is None or row.get("trip_status") not in ("in_progress",) or not started_at:
        # Trip not yet started or no plan yet — fall back to the sum of legs
        # up to and including the customer (or 0 if unknown).
        if legs and seq is not None:
            sim_remaining = sum(float(l["duration_s"]) for l in legs[: int(seq)])
            eta_seconds = int(round(sim_remaining / max(SIMULATION_SPEED, 0.001)))
        else:
            eta_seconds = 0
        stops_ahead = max(0, int(seq) - 1) if seq is not None else 0
        return {
            "eta_seconds": eta_seconds,
            "stops_ahead": stops_ahead,
            "trip_status": row.get("trip_status"),
            "start_address": START_ADDRESS_LABEL,
        }

    # Trip in progress — compute remaining sim seconds against the live clock.
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)
    elapsed_real = max(0.0, (datetime.now(timezone.utc) - started_at).total_seconds())
    sim_elapsed = elapsed_real * SIMULATION_SPEED

    target_sim = sum(float(l["duration_s"]) for l in legs[: int(seq)])
    sim_remaining = max(0.0, target_sim - sim_elapsed)
    eta_seconds = int(round(sim_remaining / max(SIMULATION_SPEED, 0.001)))

    cur_stop = int(row.get("trip_current_stop") or 0)
    stops_ahead = max(0, int(seq) - cur_stop - 1)

    return {
        "eta_seconds": eta_seconds,
        "stops_ahead": stops_ahead,
        "trip_status": row.get("trip_status"),
        "start_address": START_ADDRESS_LABEL,
    }


@router.get("/orders/{order_id}/trip", response_model=CustomerTripView)
def get_order_trip_view(order_id: int, user_id: UUID = Depends(get_current_user_id)):
    """
    Customer-facing live trip plan: the full multi-stop polyline + per-leg
    durations + a server clock anchor. Other customers' addresses/names are
    omitted; only their stop coordinates and sequence numbers are returned so
    the customer can see the full route the robot is taking.
    """
    with get_db() as (conn, cur):
        cur.execute(
            """
            SELECT
              o.id              AS order_id,
              o.trip_stop_sequence,
              t.id              AS trip_id,
              t.robot_id,
              t.status          AS trip_status,
              t.order_count,
              t.current_stop,
              t.started_at,
              t.legs_geojson,
              r.name            AS robot_name
            FROM public.orders o
            LEFT JOIN public.delivery_trips t ON t.id = o.delivery_trip_id
            LEFT JOIN public.robots r        ON r.id = t.robot_id
            WHERE o.id = %(order_id)s AND o.user_id = %(user_id)s
            """,
            {"order_id": order_id, "user_id": str(user_id)},
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Order not found")

        if not row.get("trip_id"):
            raise HTTPException(status_code=409, detail="Order is not on a trip yet")

        # Reconcile any milestones the simulator clock has crossed.
        if row.get("trip_status") == "in_progress":
            _reconcile_trip_progress(
                cur,
                {
                    "id": row["trip_id"],
                    "robot_id": row["robot_id"],
                    "status": row["trip_status"],
                    "order_count": row["order_count"],
                    "current_stop": row["current_stop"],
                    "started_at": row["started_at"],
                    "legs_geojson": row["legs_geojson"],
                },
            )

        cur.execute(
            """
            SELECT
              o.id AS order_id,
              o.trip_stop_sequence,
              o.delivery_address_latitude  AS lat,
              o.delivery_address_longitude AS lng
            FROM public.orders o
            WHERE o.delivery_trip_id = %(id)s
            ORDER BY o.trip_stop_sequence ASC
            """,
            {"id": row["trip_id"]},
        )
        stops = cur.fetchall()
        conn.commit()

    legs = _parse_legs(row.get("legs_geojson"))
    your_seq = int(row["trip_stop_sequence"])

    return CustomerTripView(
        trip_id=int(row["trip_id"]),
        robot_name=row["robot_name"] or "",
        status=row["trip_status"] or "planned",
        started_at=row.get("started_at"),
        server_now=datetime.now(timezone.utc),
        speed_multiplier=SIMULATION_SPEED,
        legs=[LegPlan(**leg) for leg in legs],
        stops=[
            CustomerStopMarker(
                stop_sequence=int(s["trip_stop_sequence"]),
                longitude=float(s["lng"]),
                latitude=float(s["lat"]),
                is_you=(int(s["order_id"]) == int(row["order_id"])),
            )
            for s in stops
        ],
        your_stop_sequence=your_seq,
        order_count=int(row["order_count"]),
        restaurant_lng=START_LNG,
        restaurant_lat=START_LAT,
    )