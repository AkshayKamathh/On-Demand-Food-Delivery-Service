import os
import json
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List
from urllib.parse import quote, quote as url_quote
from uuid import UUID

import math
import requests
import stripe
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from db import get_db
from deps import get_current_user_id
from schemas.checkout import (
    AddressSearchResponse,
    AddressSuggestion,
    AddressValidationRequest,
    CheckoutConfirmRequest,
    CheckoutItem,
    CheckoutSessionCreate,
    CheckoutSessionResponse,
    CheckoutSummary,
    OrderConfirmationResponse,
    ValidatedAddress,
)
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


def mapbox_directions_geometry(
    *, start_lng: float, start_lat: float, end_lng: float, end_lat: float
) -> List[List[float]]:
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
        return []

    geometry = routes[0].get("geometry") or {}
    coords = geometry.get("coordinates") or []
    return coords


def _encode_polyline(coords: List[List[float]], *, precision: int) -> str:
    """
    Encodes coordinates (lng, lat) into a polyline string.

    precision=5 -> polyline (1e5)
    precision=6 -> polyline6 (1e6)
    """

    def encode_value(v: int) -> str:
        v = ~(v << 1) if v < 0 else (v << 1)
        chunks = []
        while v >= 0x20:
            chunks.append(chr((0x20 | (v & 0x1F)) + 63))
            v >>= 5
        chunks.append(chr(v + 63))
        return "".join(chunks)

    last_lat = 0
    last_lng = 0
    out: List[str] = []

    scale = 10**precision

    for lng, lat in coords:
        lat_i = int(round(lat * scale))
        lng_i = int(round(lng * scale))
        out.append(encode_value(lat_i - last_lat))
        out.append(encode_value(lng_i - last_lng))
        last_lat = lat_i
        last_lng = lng_i

    return "".join(out)


def _geojson_route_overlay(coords: List[List[float]]) -> str:
    """
    Build a Mapbox Static API geojson(...) overlay for the route line.
    This is more robust than polyline overlays and avoids precision pitfalls.
    """
    if not coords:
        return ""

    feature = {
        "type": "Feature",
        "properties": {
            "stroke": "#16a34a",
            "stroke-width": 5,
            "stroke-opacity": 0.7,
        },
        "geometry": {
            "type": "LineString",
            "coordinates": coords,
        },
    }
    encoded = url_quote(json.dumps(feature, separators=(",", ":")), safe="")
    return f"geojson({encoded})"

def _interpolate_route(coords: List[List[float]], progress: float) -> tuple[List[List[float]], List[List[float]], List[float]]:
    """
    Split route coords into (traveled, remaining, driver_pos) at the given progress (0..1).
    traveled  — coords from start up to driver (inclusive of split point)
    remaining — coords from driver to end (inclusive of split point)
    driver_pos — [lng, lat] of the driver right now
    """
    if not coords:
        return [], [], [0.0, 0.0]
    if progress <= 0:
        return [], list(coords), list(coords[0])
    if progress >= 1:
        return list(coords), [], list(coords[-1])

    # Build cumulative distances
    seg_lengths: List[float] = []
    total = 0.0
    for i in range(len(coords) - 1):
        dx = coords[i + 1][0] - coords[i][0]
        dy = coords[i + 1][1] - coords[i][1]
        d = math.sqrt(dx * dx + dy * dy)
        seg_lengths.append(d)
        total += d

    target = progress * total
    accumulated = 0.0
    traveled: List[List[float]] = [list(coords[0])]

    for i, seg_len in enumerate(seg_lengths):
        if accumulated + seg_len >= target:
            t = (target - accumulated) / seg_len if seg_len > 0 else 0.0
            split = [
                coords[i][0] + t * (coords[i + 1][0] - coords[i][0]),
                coords[i][1] + t * (coords[i + 1][1] - coords[i][1]),
            ]
            traveled.append(split)
            remaining = [split] + [list(c) for c in coords[i + 1 :]]
            return traveled, remaining, split
        accumulated += seg_len
        traveled.append(list(coords[i + 1]))

    return list(coords), [], list(coords[-1])


def _geojson_line_overlay(coords: List[List[float]], color: str, opacity: float = 0.85, width: int = 5) -> str:
    """Build a GeoJSON line overlay for the Mapbox Static API."""
    if len(coords) < 2:
        return ""
    feature = {
        "type": "Feature",
        "properties": {
            "stroke": color,
            "stroke-width": width,
            "stroke-opacity": opacity,
        },
        "geometry": {"type": "LineString", "coordinates": coords},
    }
    encoded = url_quote(json.dumps(feature, separators=(",", ":")), safe="")
    return f"geojson({encoded})"


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
              status = 'submitted',
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
        cur.execute(
            """
            SELECT
              id,
              user_id,
              status,
              payment_status,
              subtotal,
              delivery_fee,
              total,
              currency,
              recipient_name,
              email,
              delivery_address,
              delivery_address_latitude,
              delivery_address_longitude,
              delivery_notes,
              paid_at,
              delivered_at,
              created_at
            FROM public.orders
            WHERE id = %(order_id)s AND user_id = %(user_id)s
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
    with get_db() as (conn, cur):
        cur.execute(
            """
            SELECT delivery_address_latitude, delivery_address_longitude
            FROM public.orders
            WHERE id = %(order_id)s AND user_id = %(user_id)s
            """,
            {"order_id": order_id, "user_id": str(user_id)},
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Order not found")

    eta_seconds = mapbox_directions_eta_seconds(
        start_lng=START_LNG,
        start_lat=START_LAT,
        end_lng=float(row["delivery_address_longitude"]),
        end_lat=float(row["delivery_address_latitude"]),
    )

    return {"eta_seconds": eta_seconds, "start_address": START_ADDRESS_LABEL}


def _fit_map_view(start_lng: float, start_lat: float, end_lng: float, end_lat: float, width: int = 900, height: int = 520, padding: int = 80):
    lon_span = abs(end_lng - start_lng)
    lat_span = abs(end_lat - start_lat)

    center_lng = (start_lng + end_lng) / 2
    center_lat = (start_lat + end_lat) / 2

    if lon_span == 0 and lat_span == 0:
        return center_lng, center_lat, 14

    # More padding => smaller zoom so both markers stay visible.
    safe_width = max(1, width - 2 * padding)
    safe_height = max(1, height - 2 * padding)

    # Convert degree span to an approximate zoom fit.
    lon_zoom = 360 / lon_span if lon_span > 0 else float("inf")
    lat_zoom = 170 / lat_span if lat_span > 0 else float("inf")

    zoom_x = math.log2((safe_width * 360) / (256 * lon_span)) if lon_span > 0 else 14
    zoom_y = math.log2((safe_height * 170) / (256 * lat_span)) if lat_span > 0 else 14

    zoom = min(zoom_x, zoom_y)
    zoom = max(3, min(15, zoom))

    return center_lng, center_lat, zoom


@router.get("/orders/{order_id}/map")
def get_order_map(
    order_id: int,
    progress: float = Query(0.0, ge=0.0, le=1.0),
    user_id: UUID = Depends(get_current_user_id),
):
    if not MAPBOX_ACCESS_TOKEN:
        raise HTTPException(status_code=500, detail="MAPBOX_ACCESS_TOKEN is not set")

    with get_db() as (conn, cur):
        cur.execute(
            """
            SELECT delivery_address_latitude, delivery_address_longitude
            FROM public.orders
            WHERE id = %(order_id)s AND user_id = %(user_id)s
            """,
            {"order_id": order_id, "user_id": str(user_id)},
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Order not found")

    end_lat = float(row["delivery_address_latitude"])
    end_lng = float(row["delivery_address_longitude"])

    route_coords = mapbox_directions_geometry(
        start_lng=START_LNG,
        start_lat=START_LAT,
        end_lng=end_lng,
        end_lat=end_lat,
    )

    overlays: List[str] = []

    if progress <= 0 or not route_coords:
        # No movement yet — show full green route + A + B pins
        full_line = _geojson_line_overlay(route_coords, "#16a34a")
        if full_line:
            overlays.append(full_line)
        overlays.append(f"pin-s-a+0f172a({START_LNG},{START_LAT})")
        overlays.append(f"pin-s-b+16a34a({end_lng},{end_lat})")
    else:
        # Driver is moving — split route into traveled (gray) + remaining (green)
        traveled, remaining, driver_pos = _interpolate_route(route_coords, progress)

        gray_line = _geojson_line_overlay(traveled, "#9ca3af", opacity=0.7, width=5)
        if gray_line:
            overlays.append(gray_line)

        green_line = _geojson_line_overlay(remaining, "#16a34a", opacity=0.85, width=5)
        if green_line:
            overlays.append(green_line)

        # Driver marker (orange truck pin) replaces the A pin
        driver_lng, driver_lat = driver_pos[0], driver_pos[1]
        overlays.append(f"pin-s+f97316({driver_lng},{driver_lat})")

        # Destination B pin
        overlays.append(f"pin-s-b+16a34a({end_lng},{end_lat})")

    overlay_str = ",".join(overlays)

    center_lng, center_lat, zoom = _fit_map_view(
        START_LNG, START_LAT, end_lng, end_lat, width=900, height=520, padding=90
    )

    static_url = (
        "https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/"
        f"{overlay_str}/{center_lng},{center_lat},{zoom:.2f}/900x520@2x"
    )

    response = requests.get(
        static_url,
        params={"access_token": MAPBOX_ACCESS_TOKEN},
        timeout=10,
    )
    try:
        response.raise_for_status()
    except requests.HTTPError:
        raise HTTPException(
            status_code=502,
            detail=f"Mapbox static map failed: {response.status_code} {response.text}",
        )

    return Response(content=response.content, media_type="image/png")