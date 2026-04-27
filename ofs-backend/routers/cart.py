from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from typing import List
from uuid import UUID

from db import get_db
from deps import require_user
from schemas.cart import CartItem, CartItemCreate, CartItemUpdate

router = APIRouter(prefix="/cart", tags=["cart"])
MAX_ORDER_WEIGHT_LBS = Decimal("200")


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
            ORDER BY ci.id DESC
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
        cur.execute(
            """
            SELECT item_id, description, price, weight, image_url
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

        cur.execute(
            """
            INSERT INTO public.cart_items (user_id, item_id, quantity)
            VALUES (%(uid)s, %(item_id)s, %(q)s)
            ON CONFLICT (user_id, item_id)
            DO UPDATE SET
              quantity = public.cart_items.quantity + EXCLUDED.quantity
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
        cur.execute(
            """
            SELECT ci.id, ci.item_id, ci.quantity, i.weight
            FROM public.cart_items ci
            JOIN public.items i ON i.item_id = ci.item_id
            WHERE ci.id = %(id)s AND ci.user_id = %(uid)s
            """,
            {"id": cart_item_id, "uid": str(user_id)},
        )
        existing = cur.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Cart item not found")

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
            UPDATE public.cart_items
            SET quantity = %(q)s
            WHERE id = %(id)s AND user_id = %(uid)s
            RETURNING id, item_id, quantity
            """,
            {"q": payload.quantity, "id": cart_item_id, "uid": str(user_id)},
        )
        row = cur.fetchone()

        cur.execute(
            """
            SELECT description, price, weight, image_url
            FROM public.items
            WHERE item_id = %(item_id)s
            """,
            {"item_id": row["item_id"]},
        )
        prod = cur.fetchone()
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


@router.delete("/items/{cart_item_id}", status_code=204)
def delete_cart_item(cart_item_id: int, user_id: UUID = Depends(require_user)):
    with get_db() as (conn, cur):
        cur.execute(
            """
            DELETE FROM public.cart_items
            WHERE id = %(id)s AND user_id = %(uid)s
            """,
            {"id": cart_item_id, "uid": str(user_id)},
        )
        deleted = cur.rowcount
        conn.commit()

    if deleted == 0:
        raise HTTPException(status_code=404, detail="Cart item not found")


@router.delete("/items", status_code=204)
def clear_cart(user_id: UUID = Depends(require_user)):
    with get_db() as (conn, cur):
        cur.execute(
            "DELETE FROM public.cart_items WHERE user_id = %(uid)s",
            {"uid": str(user_id)},
        )
        conn.commit()
