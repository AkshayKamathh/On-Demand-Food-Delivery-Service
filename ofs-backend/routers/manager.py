from typing import List

from fastapi import APIRouter, HTTPException

from db import get_db
from schemas.orders import (
    ManagerOrderListItem,
    OrderStatusUpdate,
    OrderStatusUpdateResponse,
    VALID_ORDER_STATUSES,
)

router = APIRouter(prefix="/manager", tags=["manager"])


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

    with get_db() as (conn, cur):
        delivered_at_sql = ", delivered_at = now()" if payload.status == "delivered" else ""
        cur.execute(
            f"""
            UPDATE public.orders
            SET status = %(status)s, updated_at = now(){delivered_at_sql}
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
