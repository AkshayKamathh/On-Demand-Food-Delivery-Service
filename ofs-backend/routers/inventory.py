from fastapi import APIRouter, HTTPException
from typing import List, Optional
from psycopg.types.json import Jsonb
from db import get_db
from schemas.inventory import InventoryItem, InventoryUpdate, InventoryCreate

router = APIRouter(prefix="/inventory", tags=["inventory"])

#Define stock status based on quantity
def status_from_stock(stock: int) -> str:
    if stock <= 0:
        return "Out of Stock"
    if stock <= 10:
        return "Low Stock"
    return "In Stock"

#Helper function to parse SKU to item_id
def parse_item_id(sku: str) -> int:
    #We treat "sku" as item_id (string) to keep frontend keys stable
    try:
        return int(sku)
    except ValueError:
        raise HTTPException(status_code=400, detail="SKU must be a numeric item_id")
    
#Category mapping
CATEGORY_NAME_TO_ID = {
    "Fruits": 1,
    "Vegetables": 2,
    "Dairy": 3,
    "Bakery": 4,
    "Meat & Seafood": 5
}

CATEGORY_ID_TO_NAME = {v: k for k, v in CATEGORY_NAME_TO_ID.items()}
    
#GET /inventory
@router.get("/", response_model=List[InventoryItem])
def list_inventory():
    with get_db() as (conn, cur):
        cur.execute(
            """
            SELECT i.item_id, i.description, i.category_id, i.price, i.weight,
                   i.stock, i.is_active, i.image_url,
                   d.long_description, d.nutrition, d.extra
            FROM public.items i
            LEFT JOIN public.item_details d ON d.item_id = i.item_id
            ORDER BY i.item_id
            """
        )
        rows = cur.fetchall()

    items: List[InventoryItem] = []
    for r in rows:
        stock = int(r["stock"]) if r["stock"] is not None else 0
        category_id = r["category_id"]
        category_name = CATEGORY_ID_TO_NAME.get(category_id, "Uncategorized")
        items.append(
            InventoryItem(
                sku=str(r["item_id"]),
                name=r["description"],
                category=category_name,
                price=float(r["price"]) if r["price"] is not None else 0.0,
                weight_lb=float(r["weight"]) if r["weight"] is not None else 0.0,
                stock=stock,
                status=status_from_stock(stock),
                image_url=r["image_url"],
                is_active=bool(r["is_active"]),
                long_description=r["long_description"],
                nutrition=r["nutrition"],
                extra=r["extra"],
            )
        )
    return items

#GET /inventory/{sku}
@router.get("/{sku}", response_model=InventoryItem)
def get_inventory_item(sku: str):
    item_id = parse_item_id(sku)

    with get_db() as (conn, cur):
        cur.execute(
            """
            SELECT i.item_id, i.description, i.category_id, i.price, i.weight,
                   i.stock, i.is_active, i.image_url,
                   d.long_description, d.nutrition, d.extra
            FROM public.items i
            LEFT JOIN public.item_details d ON d.item_id = i.item_id
            WHERE i.item_id = %(item_id)s
            """,
            {"item_id": item_id},
        )
        r = cur.fetchone()

    if not r:
        raise HTTPException(status_code=404, detail="Item not found")

    stock = int(r["stock"]) if r["stock"] is not None else 0
    category_id = r["category_id"]
    category_name = CATEGORY_ID_TO_NAME.get(category_id, "Uncategorized")
    return InventoryItem(
        sku=str(r["item_id"]),
        name=r["description"],
        category=category_name,
        price=float(r["price"]) if r["price"] is not None else 0.0,
        weight_lb=float(r["weight"]) if r["weight"] is not None else 0.0,
        stock=stock,
        status=status_from_stock(stock),
        image_url=r["image_url"],
        is_active=bool(r["is_active"]),
        long_description=r["long_description"],
        nutrition=r["nutrition"],
        extra=r["extra"],
    )

#PATCH /inventory/{sku}
@router.patch("/{sku}", response_model=InventoryItem)
def update_inventory_item(sku: str, payload: InventoryUpdate):
    item_id = parse_item_id(sku)
    data = payload.model_dump(exclude_unset=True)

    if "stock" in data and data["stock"] is not None and data["stock"] < 0:
        raise HTTPException(status_code=400, detail="Stock cannot be negative")

    set_clauses = []
    params = {"item_id": item_id}

    if "name" in data and data["name"] is not None:
        set_clauses.append("description = %(description)s")
        params["description"] = data["name"]

    if "category" in data and data["category"] is not None:
        category_id = CATEGORY_NAME_TO_ID.get(data["category"])
        if category_id is None:
            raise HTTPException(status_code=400, detail=f"Unknown category: {data['category']}")
        set_clauses.append("category_id = %(category_id)s")
        params["category_id"] = category_id

    if "weight_lb" in data and data["weight_lb"] is not None:
        if data["weight_lb"] <= 0:
            raise HTTPException(status_code=400, detail="Weight must be greater than 0")
        set_clauses.append("weight = %(weight)s")
        params["weight"] = data["weight_lb"]

    if "price" in data and data["price"] is not None:
        set_clauses.append("price = %(price)s")
        params["price"] = data["price"]

    if "stock" in data and data["stock"] is not None:
        set_clauses.append("stock = %(stock)s")
        params["stock"] = data["stock"]

    if "is_active" in data and data["is_active"] is not None:
        set_clauses.append("is_active = %(is_active)s")
        params["is_active"] = data["is_active"]

    if "image_url" in data:
        set_clauses.append("image_url = %(image_url)s")
        params["image_url"] = data["image_url"]

    detail_clauses: dict = {}
    if "long_description" in data:
        detail_clauses["long_description"] = data["long_description"]
    if "nutrition" in data:
        detail_clauses["nutrition"] = Jsonb(data["nutrition"]) if data["nutrition"] is not None else None
    if "extra" in data:
        detail_clauses["extra"] = Jsonb(data["extra"]) if data["extra"] is not None else None

    if not set_clauses and not detail_clauses:
        raise HTTPException(status_code=400, detail="No updatable fields provided")

    with get_db() as (conn, cur):
        if set_clauses:
            cur.execute(
                f"""
                UPDATE public.items
                SET {", ".join(set_clauses)}
                WHERE item_id = %(item_id)s
                RETURNING item_id, description, category_id, price, weight, stock, is_active, image_url
                """,
                params,
            )
            r = cur.fetchone()
            if not r:
                raise HTTPException(status_code=404, detail="Item not found")
        else:
            cur.execute(
                """
                SELECT item_id, description, category_id, price, weight, stock, is_active, image_url
                FROM public.items WHERE item_id = %(item_id)s
                """,
                {"item_id": item_id},
            )
            r = cur.fetchone()
            if not r:
                raise HTTPException(status_code=404, detail="Item not found")

        long_desc = None
        nutrition = None
        extra_data = None
        if detail_clauses:
            upsert_cols = list(detail_clauses.keys())
            upsert_vals = {k: v for k, v in detail_clauses.items()}
            upsert_vals["item_id"] = item_id
            set_detail = ", ".join(f"{c} = %({c})s" for c in upsert_cols)
            cur.execute(
                f"""
                INSERT INTO public.item_details (item_id, {", ".join(upsert_cols)})
                VALUES (%(item_id)s, {", ".join(f"%({c})s" for c in upsert_cols)})
                ON CONFLICT (item_id) DO UPDATE SET {set_detail}
                RETURNING long_description, nutrition, extra
                """,
                upsert_vals,
            )
            detail_row = cur.fetchone()
            if detail_row:
                long_desc = detail_row["long_description"]
                nutrition = detail_row["nutrition"]
                extra_data = detail_row["extra"]
        else:
            cur.execute(
                "SELECT long_description, nutrition, extra FROM public.item_details WHERE item_id = %(item_id)s",
                {"item_id": item_id},
            )
            detail_row = cur.fetchone()
            if detail_row:
                long_desc = detail_row["long_description"]
                nutrition = detail_row["nutrition"]
                extra_data = detail_row["extra"]

        conn.commit()

    stock = int(r["stock"]) if r["stock"] is not None else 0
    category_name = CATEGORY_ID_TO_NAME.get(r["category_id"], "Uncategorized")
    return InventoryItem(
        sku=str(r["item_id"]),
        name=r["description"],
        category=category_name,
        price=float(r["price"]) if r["price"] is not None else 0.0,
        weight_lb=float(r["weight"]) if r["weight"] is not None else 0.0,
        stock=stock,
        status=status_from_stock(stock),
        image_url=r["image_url"],
        is_active=bool(r["is_active"]),
        long_description=long_desc,
        nutrition=nutrition,
        extra=extra_data,
    )

# DELETE /inventory/{sku}  — was hard delete, now soft delete
@router.delete("/{sku}")
def delete_inventory_item(sku: str):
    item_id = parse_item_id(sku)

    with get_db() as (conn, cur):
        cur.execute(
            """
            UPDATE public.items
            SET is_active = false
            WHERE item_id = %(item_id)s
            RETURNING item_id, description, category_id, price, weight, stock, is_active
            """,
            {"item_id": item_id},
        )
        r = cur.fetchone()
        if not r:
            raise HTTPException(status_code=404, detail="Item not found")
        conn.commit()

    stock = int(r["stock"]) if r["stock"] is not None else 0
    category_name = CATEGORY_ID_TO_NAME.get(r["category_id"], "Uncategorized")
    return InventoryItem(
        sku=str(r["item_id"]),
        name=r["description"],
        category=category_name,
        price=float(r["price"]) if r["price"] is not None else 0.0,
        weight_lb=float(r["weight"]) if r["weight"] is not None else 0.0,
        stock=stock,
        status=status_from_stock(stock),
        is_active=False,
    )

#POST /inventory
@router.post("/", response_model=InventoryItem, status_code=201)
def create_inventory_item(payload: InventoryCreate):
    if payload.stock < 0:
        raise HTTPException(status_code=400, detail="Stock cannot be negative")

    category_id = CATEGORY_NAME_TO_ID.get(payload.category)
    if category_id is None:
        raise HTTPException(status_code=400, detail="Unknown category")

    with get_db() as (conn, cur):
        cur.execute(
            """
            INSERT INTO public.items (description, category_id, price, weight, stock, image_url)
            VALUES (%(desc)s, %(category_id)s, %(price)s, %(weight)s, %(stock)s, %(image_url)s)
            RETURNING item_id, description, category_id, price, weight, stock, is_active, image_url
            """,
            {
                "desc": payload.name,
                "category_id": category_id,
                "price": payload.price,
                "weight": payload.weight_lb,
                "stock": payload.stock,
                "image_url": payload.image_url,
            },
        )
        r = cur.fetchone()
        conn.commit()

    stock = int(r["stock"]) if r["stock"] is not None else 0
    category_name = CATEGORY_ID_TO_NAME.get(r["category_id"], "Uncategorized")

    return InventoryItem(
        sku=str(r["item_id"]),
        name=r["description"],
        category=category_name,
        price=float(r["price"]) if r["price"] is not None else 0.0,
        weight_lb=float(r["weight"]) if r["weight"] is not None else 0.0,
        stock=stock,
        status=status_from_stock(stock),
        is_active=bool(r["is_active"]),
        image_url=r["image_url"],
    )
