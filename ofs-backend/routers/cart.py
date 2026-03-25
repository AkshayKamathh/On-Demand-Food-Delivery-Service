from fastapi import APIRouter, Depends, HTTPException
from typing import List
from uuid import UUID

from db import get_db
from deps import get_current_user_id
from schemas.cart import CartItem, CartItemCreate, CartItemUpdate

router = APIRouter(prefix="/cart", tags=["cart"])

# Still need to update stock and quantity handling in DB

# GET /cart/items
@router.get("/items", response_model=List[CartItem])
def list_cart_items(user_id: UUID = Depends(get_current_user_id)):
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


# POST /cart/items
@router.post("/items", response_model=CartItem, status_code=201)
def add_cart_item(
    payload: CartItemCreate,
    user_id: UUID = Depends(get_current_user_id),
):
    with get_db() as (conn, cur):
        # check product
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

        # check existing cart item
        cur.execute(
            """
            SELECT id, quantity
            FROM public.cart_items
            WHERE user_id = %(uid)s AND item_id = %(item_id)s
            """,
            {"uid": str(user_id), "item_id": payload.item_id},
        )
        existing = cur.fetchone()

        if existing:
            new_qty = existing["quantity"] + payload.quantity
            cur.execute(
                """
                UPDATE public.cart_items
                SET quantity = %(q)s, updated_at = now()
                WHERE id = %(id)s
                RETURNING id, item_id, quantity
                """,
                {"q": new_qty, "id": existing["id"]},
            )
            row = cur.fetchone()
        else:
            cur.execute(
                """
                INSERT INTO public.cart_items (user_id, item_id, quantity)
                VALUES (%(uid)s, %(item_id)s, %(q)s)
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


# PATCH /cart/items/{id}
@router.patch("/items/{cart_item_id}", response_model=CartItem)
def update_cart_item(
    cart_item_id: int,
    payload: CartItemUpdate,
    user_id: UUID = Depends(get_current_user_id),
):
    with get_db() as (conn, cur):
        cur.execute(
            """
            UPDATE public.cart_items
            SET quantity = %(q)s, updated_at = now()
            WHERE id = %(id)s AND user_id = %(uid)s
            RETURNING id, item_id, quantity
            """,
            {"q": payload.quantity, "id": cart_item_id, "uid": str(user_id)},
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Cart item not found")

        cur.execute(
            """
            SELECT description, price, weight, image_url
            FROM public.items
            WHERE item_id = %(item_id)s
            """,
            {"item_id": row["item_id"]},
        )
        prod = cur.fetchone()

    return CartItem(
        id=row["id"],
        item_id=row["item_id"],
        quantity=row["quantity"],
        description=prod["description"],
        price=float(prod["price"]) if prod["price"] is not None else 0.0,
        weight=float(prod["weight"]) if prod["weight"] is not None else 0.0,
        image_url=prod["image_url"],
    )


# DELETE /cart/items
@router.delete("/items", status_code=204)
def clear_cart(user_id: UUID = Depends(get_current_user_id)):
    with get_db() as (conn, cur):
        cur.execute(
            "DELETE FROM public.cart_items WHERE user_id = %(uid)s",
            {"uid": str(user_id)},
        )
        conn.commit()
