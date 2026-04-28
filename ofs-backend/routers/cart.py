from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from typing import List
from uuid import UUID

from db import get_db
from deps import require_user
from schemas.cart import CartItem, CartItemCreate, CartItemUpdate

router = APIRouter(prefix="/cart", tags=["cart"])
MAX_ORDER_WEIGHT_LBS = Decimal("200")


def lock_user_cart(cur, user_id: UUID) -> None:
    cur.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended(%(uid)s, 0))",
        {"uid": str(user_id)},
    )


def current_cart_weight(cur, user_id: UUID) -> Decimal:
    cur.execute(
        """
        SELECT COALESCE(SUM(i.weight * ci.quantity), 0) AS total_weight
        FROM public.cart_items ci
        JOIN public.items i ON i.item_id = ci.item_id
        WHERE ci.user_id = %(uid)s
        """,
        {"uid": str(user_id)},
    )
    row = cur.fetchone() or {}
    return Decimal(str(row.get("total_weight") or 0))

# update the cart routers based on added unique cart id
@router.get("/items", response_model=List[CartItem])
def list_cart_items(user_id: UUID = Depends((require_user))):
    with get_db() as (conn, cur):
        cur.execute(
            """
            SELECT
            ci.id,
            ci.item_id,
            ci.quantity,
            i.description,
            i.price,
            i.weight,
            i.image_url
            FROM public.cart_items ci
            JOIN public.items i ON i.item_id = ci.item_id
            WHERE ci.user_id = %(uid)s
                AND i.is_active = true
            ORDER BY ci.updated_at DESC, ci.id DESC
            """,
            {"uid": str(user_id)},
        )
        rows = cur.fetchall()

    return [
        CartItem(
            id=r["id"],
            item_id=r["item_id"],
            quantity=r["quantity"],
            description=r["description"],
            price=float(r["price"]) if r["price"] is not None else 0.0,
            weight=float(r["weight"]) if r["weight"] is not None else 0.0,
            image_url=r["image_url"],
        )
        for r in rows
    ]


@router.post("/items", response_model=CartItem, status_code=201)
def add_cart_item(
    payload: CartItemCreate,
    user_id: UUID = Depends((require_user)),
):
    with get_db() as (conn, cur):
        lock_user_cart(cur, user_id)

        cur.execute(
            """
            SELECT item_id, description, price, weight, stock, image_url
            FROM public.items
            WHERE item_id = %(item_id)s
            """,
            {"item_id": payload.item_id},
        )
        prod = cur.fetchone()
        if not prod:
            raise HTTPException(status_code=404, detail="Item not found")

        proposed_total_weight = current_cart_weight(cur, user_id) + (
            Decimal(str(prod["weight"] or 0)) * Decimal(str(payload.quantity))
        )
        if proposed_total_weight > MAX_ORDER_WEIGHT_LBS:
            raise HTTPException(
                status_code=409,
                detail="Cart cannot exceed 200 lbs total weight",
            )

        available_stock = int(prod.get("stock") or 0)

        cur.execute(
            """
            SELECT quantity FROM public.cart_items
            WHERE user_id = %(uid)s AND item_id = %(item_id)s
            """,
            {"uid": str(user_id), "item_id": payload.item_id},
        )
        existing_row = cur.fetchone()
        already_in_cart = int(existing_row["quantity"]) if existing_row else 0
        requested_total = already_in_cart + payload.quantity

        if requested_total > available_stock:
            if available_stock <= 0:
                raise HTTPException(
                    status_code=409,
                    detail=f"'{prod['description']}' is out of stock.",
                )
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Only {available_stock} of '{prod['description']}' available"
                    f" ({already_in_cart} already in cart)."
                ),
            )

        cur.execute(
            """
            INSERT INTO public.cart_items (user_id, item_id, quantity)
            VALUES (%(uid)s, %(item_id)s, %(q)s)
            ON CONFLICT (user_id, item_id)
            DO UPDATE SET
              quantity = public.cart_items.quantity + EXCLUDED.quantity,
              updated_at = now()
            RETURNING id, item_id, quantity
            """,
            {"uid": str(user_id), "item_id": payload.item_id, "q": payload.quantity},
        )
        row = cur.fetchone()
        conn.commit()

    return CartItem(
        id=row["id"],
        item_id=row["item_id"],
        quantity=row["quantity"],
        description=prod["description"],
        price=float(prod["price"]) if prod["price"] is not None else 0.0,
        weight=float(prod["weight"]) if prod["weight"] is not None else 0.0,
        image_url=prod["image_url"],
    )


@router.patch("/items/{cart_item_id}", response_model=CartItem)
def update_cart_item(
    cart_item_id: int,
    payload: CartItemUpdate,
    user_id: UUID = Depends(require_user),
):
    with get_db() as (conn, cur):
        lock_user_cart(cur, user_id)

        cur.execute(
            """
            SELECT ci.id, ci.item_id, ci.quantity, i.weight, i.stock, i.description
            FROM public.cart_items ci
            JOIN public.items i ON i.item_id = ci.item_id
            WHERE ci.id = %(id)s AND ci.user_id = %(uid)s
            """,
            {"id": cart_item_id, "uid": str(user_id)},
        )
        existing = cur.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Cart item not found")

        available_stock = int(existing.get("stock") or 0)
        if payload.quantity > available_stock:
            if available_stock <= 0:
                raise HTTPException(
                    status_code=409,
                    detail=f"'{existing['description']}' is out of stock.",
                )
            raise HTTPException(
                status_code=409,
                detail=f"Only {available_stock} of '{existing['description']}' available.",
            )

        current_total_weight = current_cart_weight(cur, user_id)
        item_weight = Decimal(str(existing["weight"] or 0))
        old_line_weight = item_weight * Decimal(str(existing["quantity"] or 0))
        new_line_weight = item_weight * Decimal(str(payload.quantity))
        proposed_total_weight = current_total_weight - old_line_weight + new_line_weight
        if proposed_total_weight > MAX_ORDER_WEIGHT_LBS:
            raise HTTPException(
                status_code=409,
                detail="Cart cannot exceed 200 lbs total weight",
            )

        cur.execute(
            """
            WITH upd AS (
              UPDATE public.cart_items
              SET quantity = %(q)s, updated_at = now()
              WHERE id = %(id)s AND user_id = %(uid)s
              RETURNING id, item_id, quantity
            )
            SELECT upd.id, upd.item_id, upd.quantity,
                   i.description, i.price, i.weight, i.image_url
            FROM upd
            JOIN public.items i ON i.item_id = upd.item_id
            """,
            {"q": payload.quantity, "id": cart_item_id, "uid": str(user_id)},
        )
        row = cur.fetchone()
        conn.commit()

    return CartItem(
        id=row["id"],
        item_id=row["item_id"],
        quantity=row["quantity"],
        description=row["description"],
        price=float(row["price"]) if row["price"] is not None else 0.0,
        weight=float(row["weight"]) if row["weight"] is not None else 0.0,
        image_url=row["image_url"],
    )


@router.delete("/items/{cart_item_id}", status_code=204)
def delete_cart_item(cart_item_id: int, user_id: UUID = Depends(require_user)):
    with get_db() as (conn, cur):
        lock_user_cart(cur, user_id)
        cur.execute(
            """
            DELETE FROM public.cart_items
            WHERE id = %(id)s AND user_id = %(uid)s
            """,
            {"id": cart_item_id, "uid": str(user_id)},
        )
        conn.commit()


@router.delete("/items", status_code=204)
def clear_cart(user_id: UUID = Depends(require_user)):
    with get_db() as (conn, cur):
        cur.execute(
            "DELETE FROM public.cart_items WHERE user_id = %(uid)s",
            {"uid": str(user_id)},
        )
        conn.commit()
