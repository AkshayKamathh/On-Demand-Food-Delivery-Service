from datetime import datetime
from decimal import Decimal
from typing import Dict, List

from fastapi import APIRouter, Query

from db import get_db
from schemas.sales import (
    CategoryBreakdownItem,
    MonthlyRevenuePoint,
    ProductSalesItem,
    SalesStats,
    SalesSummaryResponse,
    TopProductItem,
)

router = APIRouter(prefix="/manager/sales", tags=["sales"])

MONTH_LABELS = {
    1: "Jan",
    2: "Feb",
    3: "Mar",
    4: "Apr",
    5: "May",
    6: "Jun",
    7: "Jul",
    8: "Aug",
    9: "Sep",
    10: "Oct",
    11: "Nov",
    12: "Dec",
}

CATEGORY_ID_TO_NAME = {
    1: "Fruits",
    2: "Vegetables",
    3: "Dairy",
    4: "Bakery",
    5: "Meat & Seafood",
}


def _as_float(value) -> float:
    return float(value) if value is not None else 0.0


@router.get("/summary", response_model=SalesSummaryResponse)
def get_sales_summary(year: int = Query(default_factory=lambda: datetime.now().year)):
    with get_db() as (conn, cur):
        cur.execute(
            """
            SELECT
              COALESCE(SUM(total), 0) AS total_revenue,
              COUNT(*) AS total_orders,
              COUNT(DISTINCT user_id) AS unique_customers
            FROM public.orders
            WHERE payment_status = 'paid'
              AND EXTRACT(YEAR FROM COALESCE(paid_at, created_at)) = %(year)s
            """,
            {"year": year},
        )
        stats_row = cur.fetchone() or {}

        cur.execute(
            """
            SELECT
              COALESCE(SUM(oi.quantity), 0) AS items_sold
            FROM public.order_items oi
            JOIN public.orders o ON o.id = oi.order_id
            WHERE o.payment_status = 'paid'
              AND EXTRACT(YEAR FROM COALESCE(o.paid_at, o.created_at)) = %(year)s
            """,
            {"year": year},
        )
        items_row = cur.fetchone() or {}

        cur.execute(
            """
            SELECT
              EXTRACT(MONTH FROM COALESCE(o.paid_at, o.created_at))::int AS month_num,
              COALESCE(SUM(o.total), 0) AS revenue
            FROM public.orders o
            WHERE o.payment_status = 'paid'
              AND EXTRACT(YEAR FROM COALESCE(o.paid_at, o.created_at)) = %(year)s
            GROUP BY month_num
            ORDER BY month_num
            """,
            {"year": year},
        )
        monthly_rows = cur.fetchall()

        cur.execute(
            """
            SELECT
              i.category_id,
              COALESCE(SUM(oi.line_total), 0) AS revenue
            FROM public.order_items oi
            JOIN public.orders o ON o.id = oi.order_id
            JOIN public.items i ON i.item_id = oi.item_id
            WHERE o.payment_status = 'paid'
              AND EXTRACT(YEAR FROM COALESCE(o.paid_at, o.created_at)) = %(year)s
            GROUP BY i.category_id
            ORDER BY revenue DESC
            """,
            {"year": year},
        )
        category_rows = cur.fetchall()

        cur.execute(
            """
            SELECT
              oi.item_id,
              MAX(oi.description) AS name,
              COALESCE(SUM(oi.quantity), 0) AS units,
              COALESCE(SUM(oi.line_total), 0) AS revenue
            FROM public.order_items oi
            JOIN public.orders o ON o.id = oi.order_id
            WHERE o.payment_status = 'paid'
              AND EXTRACT(YEAR FROM COALESCE(o.paid_at, o.created_at)) = %(year)s
            GROUP BY oi.item_id
            ORDER BY units DESC, revenue DESC
            LIMIT 5
            """,
            {"year": year},
        )
        top_product_rows = cur.fetchall()

    monthly_by_num: Dict[int, float] = {
        int(row["month_num"]): _as_float(row["revenue"]) for row in monthly_rows
    }
    monthly_revenue: List[MonthlyRevenuePoint] = [
        MonthlyRevenuePoint(month=MONTH_LABELS[i], revenue=monthly_by_num.get(i, 0.0))
        for i in range(1, 13)
    ]

    category_total = sum(Decimal(str(row["revenue"] or 0)) for row in category_rows)
    category_breakdown: List[CategoryBreakdownItem] = []
    for row in category_rows:
        revenue = Decimal(str(row["revenue"] or 0))
        pct = float((revenue / category_total) * Decimal("100")) if category_total > 0 else 0.0
        category_breakdown.append(
            CategoryBreakdownItem(
                category=CATEGORY_ID_TO_NAME.get(row["category_id"], "Uncategorized"),
                revenue=float(revenue),
                pct=round(pct, 1),
            )
        )

    top_products = [
        TopProductItem(
            name=row["name"],
            sku=str(row["item_id"]),
            units=int(row["units"] or 0),
            revenue=_as_float(row["revenue"]),
        )
        for row in top_product_rows
    ]

    return SalesSummaryResponse(
        year=year,
        stats=SalesStats(
            total_revenue=_as_float(stats_row.get("total_revenue")),
            total_orders=int(stats_row.get("total_orders") or 0),
            unique_customers=int(stats_row.get("unique_customers") or 0),
            items_sold=int(items_row.get("items_sold") or 0),
        ),
        monthly_revenue=monthly_revenue,
        category_breakdown=category_breakdown,
        top_products=top_products,
    )


@router.get("/products", response_model=List[ProductSalesItem])
def get_product_sales(year: int = Query(default_factory=lambda: datetime.now().year)):
    """All products with paid sales in the given year, ranked by units then revenue."""
    with get_db() as (conn, cur):
        cur.execute(
            """
            SELECT
              oi.item_id,
              MAX(oi.description) AS name,
              MAX(i.category_id) AS category_id,
              COALESCE(SUM(oi.quantity), 0) AS units,
              COALESCE(SUM(oi.line_total), 0) AS revenue
            FROM public.order_items oi
            JOIN public.orders o ON o.id = oi.order_id
            LEFT JOIN public.items i ON i.item_id = oi.item_id
            WHERE o.payment_status = 'paid'
              AND EXTRACT(YEAR FROM COALESCE(o.paid_at, o.created_at)) = %(year)s
            GROUP BY oi.item_id
            ORDER BY units DESC, revenue DESC
            """,
            {"year": year},
        )
        rows = cur.fetchall()

    return [
        ProductSalesItem(
            name=row["name"] or f"Item #{row['item_id']}",
            sku=str(row["item_id"]),
            category=CATEGORY_ID_TO_NAME.get(row["category_id"], "Uncategorized"),
            units=int(row["units"] or 0),
            revenue=_as_float(row["revenue"]),
        )
        for row in rows
    ]
