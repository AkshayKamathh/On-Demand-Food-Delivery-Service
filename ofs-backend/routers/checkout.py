import os
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List
from urllib.parse import quote
from uuid import UUID

import requests
import stripe
from fastapi import APIRouter, Depends, HTTPException, Query

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

router = APIRouter(prefix="/checkout", tags=["checkout"])

MAPBOX_ACCESS_TOKEN = os.getenv("MAPBOX_ACCESS_TOKEN")
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000")
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY


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
