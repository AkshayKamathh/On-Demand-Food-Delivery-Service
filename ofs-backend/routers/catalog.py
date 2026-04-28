from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional

from db import get_db
from schemas.catalog import Product, ProductDetail

router = APIRouter(prefix="/catalog", tags=["catalog"])

@router.get("/products", response_model=List[Product])
def list_products(
    category_id: Optional[int] = Query(None),
    sort_by: Optional[str] = Query(None, pattern="^(price|description|stock)$"),
    sort_dir: str = Query("asc", pattern="^(asc|desc)$"),
):
    with get_db() as (conn, cur):
        sql = """
          SELECT
            item_id,
            description,
            category_id,
            price,
            weight,
            stock,
            image_url
          FROM public.items
        """
        params = {}
        clauses = []
        
        clauses.append("is_active = true")
        if category_id is not None:
            clauses.append("category_id = %(category_id)s")
            params["category_id"] = category_id

        if clauses:
            sql += " WHERE " + " AND ".join(clauses)

        if sort_by:
            sql += f" ORDER BY {sort_by} {sort_dir.upper()}"

        cur.execute(sql, params)
        rows = cur.fetchall()

    products = []
    for r in rows:
        products.append(
            Product(
                item_id=r["item_id"],
                description=r["description"],
                category_id=r["category_id"],
                price=float(r["price"]) if r["price"] is not None else 0.0,
                weight=float(r["weight"]) if r["weight"] is not None else 0.0,
                stock=int(r["stock"]),
                image_url=r["image_url"],
            )
        )
    return products


@router.get("/products/{item_id}", response_model=ProductDetail)
def get_product(item_id: int):
    with get_db() as (conn, cur):
        sql = """
          SELECT
            i.item_id,
            i.description,
            i.category_id,
            i.price,
            i.weight,
            i.stock,
            i.image_url,
            d.long_description,
            d.nutrition,
            d.extra
          FROM public.items i
          LEFT JOIN public.item_details d
            ON d.item_id = i.item_id
          WHERE i.item_id = %(item_id)s AND i.is_active = true
        """
        cur.execute(sql, {"item_id": item_id})
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Product not found")

    return ProductDetail(
        item_id=row["item_id"],
        description=row["description"],
        category_id=row["category_id"],
        price=float(row["price"]) if row["price"] is not None else 0.0,
        weight=float(row["weight"]) if row["weight"] is not None else 0.0,
        stock=int(row["stock"]),
        image_url=row["image_url"],
        long_description=row["long_description"],
        nutrition=row["nutrition"],
        extra=row["extra"],
    )
