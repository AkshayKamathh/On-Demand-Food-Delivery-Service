from typing import List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db import get_db
from schemas.orders import (
    ManagerOrderListItem,
    OrderStatusUpdate,
    OrderStatusUpdateResponse,
    VALID_ORDER_STATUSES,
)

router = APIRouter(prefix="/manager", tags=["manager"])


class KpiStats(BaseModel):
    todays_sales: float
    orders_in_progress: int
    low_stock_items: int
    out_for_delivery: int


@router.get("/kpis", response_model=KpiStats)
def get_kpis():
    with get_db() as (conn, cur):
        cur.execute(
            """
            SELECT
              COALESCE(SUM(CASE WHEN payment_status = 'paid'
                                 AND paid_at::date = CURRENT_DATE
                           THEN total ELSE 0 END), 0)      AS todays_sales,
              COUNT(*) FILTER (WHERE status IN ('submitted','preparing'))
                                                            AS orders_in_progress,
              (SELECT COUNT(*) FROM public.items
                WHERE stock > 0 AND stock <= 10 AND is_active = true)
                                                            AS low_stock_items,
              COUNT(*) FILTER (WHERE status = 'out_for_delivery')
                                                            AS out_for_delivery
            FROM public.orders
            """
        )
        row = cur.fetchone()
    return KpiStats(
        todays_sales=float(row["todays_sales"]),
        orders_in_progress=int(row["orders_in_progress"]),
        low_stock_items=int(row["low_stock_items"]),
        out_for_delivery=int(row["out_for_delivery"]),
    )


@router.get("/orders", response_model=List[ManagerOrderListItem])
def list_all_orders():
    with get_db() as (conn, cur):
        cur.execute(
            """
            SELECT id, created_at, total, status, recipient_name, email, delivery_address
            FROM public.orders
            ORDER BY created_at DESC, id DESC
            """
        )
        rows = cur.fetchall()

    return [
        ManagerOrderListItem(
            id=int(r["id"]),
            created_at=r["created_at"],
            total=float(r["total"]),
            status=r["status"],
            recipient_name=r["recipient_name"],
            email=r["email"],
            delivery_address=r["delivery_address"],
        )
        for r in rows
    ]


@router.patch("/orders/{order_id}/status", response_model=OrderStatusUpdateResponse)
def update_order_status(order_id: int, payload: OrderStatusUpdate):
    if payload.status not in VALID_ORDER_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{payload.status}'. Must be one of: {', '.join(sorted(VALID_ORDER_STATUSES))}",
        )

    # Statuses that mean "this order is no longer participating in a delivery
    # trip." Clearing the trip pointers here prevents the dispatcher from
    # silently skipping the order on its next run because of a stale FK.
    DETACH_FROM_TRIP = {"preparing", "submitted", "cancelled", "pending_payment"}

    set_extras = ""
    if payload.status == "delivered":
        set_extras = ", delivered_at = now()"
    elif payload.status in DETACH_FROM_TRIP:
        set_extras = ", delivery_trip_id = NULL, trip_stop_sequence = NULL"

    with get_db() as (conn, cur):
        cur.execute(
            f"""
            UPDATE public.orders
            SET status = %(status)s, updated_at = now(){set_extras}
            WHERE id = %(order_id)s
            RETURNING id, status
            """,
            {"status": payload.status, "order_id": order_id},
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Order not found")
        conn.commit()

    return OrderStatusUpdateResponse(order_id=int(row["id"]), status=row["status"])
