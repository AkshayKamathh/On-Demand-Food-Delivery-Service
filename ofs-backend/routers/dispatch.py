import json
import math
import os
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

import requests
from fastapi import APIRouter, HTTPException, Query

from db import get_db
from schemas.dispatch import (
    CAPACITY_ORDERS,
    CAPACITY_WEIGHT_LBS,
    DispatchRunResponse,
    LegPlan,
    ReadyDispatchSummary,
    ReadyOrder,
    RobotSummary,
    TripDetail,
    TripState,
    TripStateStop,
    TripStatusUpdate,
    TripStatusUpdateResponse,
    TripStop,
    TripSummary,
    VALID_TRIP_STATUSES,
)

# TODO: gate /manager/* endpoints behind a manager role once auth is introduced.

router = APIRouter(prefix="/manager", tags=["dispatch"])

MAPBOX_ACCESS_TOKEN = os.getenv("MAPBOX_ACCESS_TOKEN")

# Restaurant origin — keep in sync with ofs-backend/routers/checkout.py (START_LNG/START_LAT).
START_LNG = -121.8950
START_LAT = 37.3497

CAPACITY_WEIGHT = Decimal(str(CAPACITY_WEIGHT_LBS))

# Demo speed: 1 real second represents SIMULATION_SPEED simulated seconds.
# Default 12× → a real 5-minute Mapbox leg plays out in 25 seconds. Override
# via env (e.g. SIMULATION_SPEED=30 makes it twice as fast for screen-recording).
SIMULATION_SPEED = float(os.getenv("SIMULATION_SPEED", "12"))

# Synthetic robot speed for the no-Mapbox fallback: 12 m/s ~ 27 mph average.
FALLBACK_ROBOT_SPEED_MPS = 12.0


# ---------- Mapbox helpers ----------


def _haversine_meters(lng1: float, lat1: float, lng2: float, lat2: float) -> float:
    r = 6_371_000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _nearest_neighbor(bin_orders: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    remaining = list(bin_orders)
    cur_lng, cur_lat = START_LNG, START_LAT
    ordered: List[Dict[str, Any]] = []
    while remaining:
        best_idx = min(
            range(len(remaining)),
            key=lambda i: _haversine_meters(
                cur_lng, cur_lat, float(remaining[i]["lng"]), float(remaining[i]["lat"])
            ),
        )
        chosen = remaining.pop(best_idx)
        ordered.append(chosen)
        cur_lng, cur_lat = float(chosen["lng"]), float(chosen["lat"])
    return ordered


def _fallback_legs(
    ordered_orders: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], List[List[float]]]:
    """Build straight-line legs from restaurant -> stop1 -> ... -> stopN."""
    legs: List[Dict[str, Any]] = []
    full_route: List[List[float]] = [[START_LNG, START_LAT]]
    cur_lng, cur_lat = START_LNG, START_LAT
    for o in ordered_orders:
        next_lng, next_lat = float(o["lng"]), float(o["lat"])
        dist_m = _haversine_meters(cur_lng, cur_lat, next_lng, next_lat)
        legs.append(
            {
                "coordinates": [[cur_lng, cur_lat], [next_lng, next_lat]],
                "duration_s": dist_m / FALLBACK_ROBOT_SPEED_MPS if dist_m > 0 else 30.0,
                "distance_m": dist_m,
            }
        )
        full_route.append([next_lng, next_lat])
        cur_lng, cur_lat = next_lng, next_lat
    return legs, full_route


def _fetch_directions_legs(
    ordered_coords: List[Tuple[float, float]],
) -> Optional[Tuple[List[Dict[str, Any]], List[List[float]]]]:
    """
    Call Mapbox Directions for an ordered sequence of waypoints and return
    (legs, full_geometry). Returns None on any failure so the caller can fall
    back. Each leg is the driving polyline between consecutive waypoints.
    """
    if not MAPBOX_ACCESS_TOKEN or len(ordered_coords) < 2:
        return None

    coord_str = ";".join(f"{lng},{lat}" for lng, lat in ordered_coords)
    try:
        response = requests.get(
            f"https://api.mapbox.com/directions/v5/mapbox/driving/{coord_str}",
            params={
                "access_token": MAPBOX_ACCESS_TOKEN,
                "geometries": "geojson",
                "overview": "full",
                "steps": "true",
            },
            timeout=20,
        )
        response.raise_for_status()
        data = response.json()
    except (requests.RequestException, ValueError):
        return None

    routes = data.get("routes") or []
    if not routes:
        return None
    route = routes[0]

    legs_raw = route.get("legs") or []
    if len(legs_raw) != len(ordered_coords) - 1:
        return None

    legs_out: List[Dict[str, Any]] = []
    for i, leg in enumerate(legs_raw):
        leg_coords: List[List[float]] = []
        for step in leg.get("steps", []):
            step_geom = step.get("geometry") or {}
            step_coords = step_geom.get("coordinates") or []
            if not step_coords:
                continue
            if leg_coords and leg_coords[-1] == step_coords[0]:
                leg_coords.extend(step_coords[1:])
            else:
                leg_coords.extend(step_coords)

        # Anchor the leg to its actual waypoint endpoints — Mapbox can snap
        # the first/last step a few meters off the input coordinate.
        start_pt = [float(ordered_coords[i][0]), float(ordered_coords[i][1])]
        end_pt = [float(ordered_coords[i + 1][0]), float(ordered_coords[i + 1][1])]
        if not leg_coords:
            leg_coords = [start_pt, end_pt]
        else:
            if leg_coords[0] != start_pt:
                leg_coords[0] = start_pt
            if leg_coords[-1] != end_pt:
                leg_coords[-1] = end_pt

        if len(leg_coords) < 2:
            return None

        legs_out.append(
            {
                "coordinates": leg_coords,
                "duration_s": float(leg.get("duration") or 0.0),
                "distance_m": float(leg.get("distance") or 0.0),
            }
        )

    full_geometry = route.get("geometry", {}).get("coordinates") or []
    if not full_geometry:
        # Stitch from legs as a fallback so the manager preview still has a
        # full polyline even if Mapbox omitted it.
        full_geometry = []
        for leg in legs_out:
            if full_geometry and leg["coordinates"] and full_geometry[-1] == leg["coordinates"][0]:
                full_geometry.extend(leg["coordinates"][1:])
            else:
                full_geometry.extend(leg["coordinates"])

    return legs_out, full_geometry


def _optimized_order(bin_orders: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], bool]:
    """
    Return (ordered_orders, used_mapbox). Falls back to nearest-neighbor when
    Mapbox is unavailable or the API errors out.
    """
    if len(bin_orders) <= 1:
        return list(bin_orders), True

    if not MAPBOX_ACCESS_TOKEN:
        return _nearest_neighbor(bin_orders), False

    coords: List[Tuple[float, float]] = [(START_LNG, START_LAT)] + [
        (float(o["lng"]), float(o["lat"])) for o in bin_orders
    ]
    coord_str = ";".join(f"{lng},{lat}" for lng, lat in coords)

    try:
        response = requests.get(
            f"https://api.mapbox.com/optimized-trips/v1/mapbox/driving/{coord_str}",
            params={
                "access_token": MAPBOX_ACCESS_TOKEN,
                "source": "first",
                "destination": "any",
                "roundtrip": "false",
                # We only want the order; geometry comes from a follow-up
                # Directions call that's far less finicky to parse.
                "geometries": "geojson",
                "overview": "false",
                "steps": "false",
            },
            timeout=20,
        )
        response.raise_for_status()
        data = response.json()
        waypoints = data.get("waypoints") or []
        if not waypoints:
            raise ValueError("Mapbox optimization returned no waypoints")

        # waypoints[i].waypoint_index = visit order; index 0 is the restaurant.
        visit_entries = [
            (int(wp.get("waypoint_index", 0)), i - 1)
            for i, wp in enumerate(waypoints)
            if i > 0
        ]
        visit_entries.sort(key=lambda x: x[0])
        ordered = [bin_orders[original_idx] for _, original_idx in visit_entries]
        return ordered, True
    except (requests.RequestException, ValueError, KeyError, IndexError):
        return _nearest_neighbor(bin_orders), False


def _run_optimization(
    bin_orders: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], List[List[float]], List[Dict[str, Any]], bool]:
    """
    Returns (optimized_orders, full_route_coords, legs, route_optimized_flag).

    legs[i] = {"coordinates": [[lng,lat]...], "duration_s": float, "distance_m": float}
    leg 0 = restaurant -> stop 1, leg N-1 = stop N-1 -> stop N.
    """
    if not bin_orders:
        return [], [], [], True

    ordered, used_mapbox_for_order = _optimized_order(bin_orders)

    # Same code path for 1-stop and N-stop: ask Directions for road geometry
    # along the chosen sequence.
    seq: List[Tuple[float, float]] = [(START_LNG, START_LAT)] + [
        (float(o["lng"]), float(o["lat"])) for o in ordered
    ]
    directions = _fetch_directions_legs(seq)
    if directions is not None:
        legs, full_route = directions
        return ordered, full_route, legs, used_mapbox_for_order

    # Last resort: straight-line legs so the simulator still has timings.
    legs, full_route = _fallback_legs(ordered)
    return ordered, full_route, legs, False


# ---------- DB helpers ----------


def _fetch_ready_orders(cur, *, lock_for_update: bool) -> List[Dict[str, Any]]:
    # Postgres rejects FOR UPDATE with GROUP BY, so lock rows in a CTE first,
    # then aggregate per-order weight from order_items. LEFT JOIN so an order
    # with no items still shows up (weight 0) instead of being silently hidden.
    if lock_for_update:
        cur.execute(
            """
            WITH locked AS (
                SELECT id
                FROM public.orders
                WHERE status = 'preparing' AND delivery_trip_id IS NULL
                FOR UPDATE SKIP LOCKED
            )
            SELECT
              o.id,
              o.recipient_name,
              o.delivery_address,
              o.delivery_address_latitude AS lat,
              o.delivery_address_longitude AS lng,
              o.total,
              o.created_at,
              COALESCE(SUM(oi.unit_weight * oi.quantity), 0) AS weight
            FROM public.orders o
            JOIN locked l ON l.id = o.id
            LEFT JOIN public.order_items oi ON oi.order_id = o.id
            GROUP BY o.id
            ORDER BY weight DESC, o.created_at ASC
            """
        )
    else:
        cur.execute(
            """
            SELECT
              o.id,
              o.recipient_name,
              o.delivery_address,
              o.delivery_address_latitude AS lat,
              o.delivery_address_longitude AS lng,
              o.total,
              o.created_at,
              COALESCE(SUM(oi.unit_weight * oi.quantity), 0) AS weight
            FROM public.orders o
            LEFT JOIN public.order_items oi ON oi.order_id = o.id
            WHERE o.status = 'preparing' AND o.delivery_trip_id IS NULL
            GROUP BY o.id
            ORDER BY weight DESC, o.created_at ASC
            """
        )
    rows = cur.fetchall()

    # One-line debug breadcrumb so it's obvious from the container logs whether
    # the dispatcher is seeing the orders the operator expects.
    if not rows:
        cur.execute(
            """
            SELECT
              COUNT(*) FILTER (WHERE status = 'preparing')                              AS preparing_total,
              COUNT(*) FILTER (WHERE status = 'preparing' AND delivery_trip_id IS NULL) AS preparing_unassigned,
              COUNT(*) FILTER (WHERE status = 'preparing' AND delivery_trip_id IS NOT NULL) AS preparing_with_trip,
              COUNT(*) FILTER (WHERE status = 'pending_payment')                        AS pending_payment_total
            FROM public.orders
            """
        )
        diag = cur.fetchone() or {}
        print(
            f"[dispatch] _fetch_ready_orders empty (lock={lock_for_update}). "
            f"preparing={diag.get('preparing_total', 0)} "
            f"preparing_unassigned={diag.get('preparing_unassigned', 0)} "
            f"preparing_with_trip={diag.get('preparing_with_trip', 0)} "
            f"pending_payment={diag.get('pending_payment_total', 0)}",
            flush=True,
        )

    return rows


def _trip_summary_from_row(row: Dict[str, Any]) -> TripSummary:
    return TripSummary(
        id=int(row["id"]),
        robot_id=int(row["robot_id"]),
        robot_name=row["robot_name"],
        status=row["status"],
        order_count=int(row["order_count"]),
        total_weight=float(row["total_weight"]),
        current_stop=int(row["current_stop"] or 0),
        route_optimized=bool(row["route_optimized"]),
        started_at=row.get("started_at"),
        completed_at=row.get("completed_at"),
        created_at=row["created_at"],
    )


def _parse_legs(raw: Any) -> List[Dict[str, Any]]:
    if raw is None:
        return []
    if isinstance(raw, str):
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return []
    else:
        data = raw
    if not isinstance(data, list):
        return []
    out: List[Dict[str, Any]] = []
    for leg in data:
        if not isinstance(leg, dict):
            continue
        coords = leg.get("coordinates") or []
        if not coords or len(coords) < 2:
            continue
        out.append(
            {
                "coordinates": coords,
                "duration_s": float(leg.get("duration_s") or 0.0),
                "distance_m": float(leg.get("distance_m") or 0.0),
            }
        )
    return out


# ---------- Live state computation + lazy completion ----------


def _simulated_elapsed_s(started_at: Optional[datetime], server_now: datetime) -> float:
    if not started_at:
        return 0.0
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)
    delta = (server_now - started_at).total_seconds()
    if delta < 0:
        return 0.0
    return delta * SIMULATION_SPEED


def _completed_stops_for_elapsed(
    legs: List[Dict[str, Any]], simulated_elapsed_s: float
) -> int:
    """Number of stops fully delivered given the simulator clock."""
    cumulative = 0.0
    for i, leg in enumerate(legs):
        cumulative += float(leg.get("duration_s") or 0.0)
        if simulated_elapsed_s < cumulative:
            return i
    return len(legs)


def _reconcile_trip_progress(cur, trip_row: Dict[str, Any]) -> Dict[str, Any]:
    """
    Lazy state machine. Inspect simulated elapsed time vs leg durations and
    persist any milestones we've crossed (orders -> delivered, trip -> completed,
    robot -> idle). Returns the (possibly updated) trip row.
    """
    status = trip_row["status"]
    if status not in ("in_progress",):
        return trip_row

    legs = _parse_legs(trip_row.get("legs_geojson"))
    if not legs:
        return trip_row

    server_now = datetime.now(timezone.utc)
    elapsed = _simulated_elapsed_s(trip_row.get("started_at"), server_now)
    completed = _completed_stops_for_elapsed(legs, elapsed)
    current_persisted = int(trip_row.get("current_stop") or 0)

    if completed <= current_persisted:
        return trip_row

    # Mark the newly-delivered stops in DB.
    cur.execute(
        """
        UPDATE public.orders
        SET status = 'delivered',
            delivered_at = COALESCE(delivered_at, now()),
            updated_at = now()
        WHERE delivery_trip_id = %(id)s
          AND trip_stop_sequence <= %(seq)s
          AND status != 'delivered'
        """,
        {"id": int(trip_row["id"]), "seq": completed},
    )

    order_count = int(trip_row["order_count"])
    if completed >= order_count:
        cur.execute(
            """
            UPDATE public.delivery_trips
            SET current_stop = %(stop)s,
                status = 'completed',
                completed_at = COALESCE(completed_at, now())
            WHERE id = %(id)s
            """,
            {"id": int(trip_row["id"]), "stop": completed},
        )
        cur.execute(
            "UPDATE public.robots SET status = 'idle' WHERE id = %(id)s",
            {"id": int(trip_row["robot_id"])},
        )
        trip_row = dict(trip_row)
        trip_row["current_stop"] = completed
        trip_row["status"] = "completed"
    else:
        cur.execute(
            "UPDATE public.delivery_trips SET current_stop = %(stop)s WHERE id = %(id)s",
            {"id": int(trip_row["id"]), "stop": completed},
        )
        trip_row = dict(trip_row)
        trip_row["current_stop"] = completed

    return trip_row


# ---------- Endpoints ----------


@router.get("/dispatch/ready", response_model=ReadyDispatchSummary)
def list_ready_orders():
    with get_db() as (conn, cur):
        rows = _fetch_ready_orders(cur, lock_for_update=False)

    orders = [
        ReadyOrder(
            order_id=int(r["id"]),
            recipient_name=r["recipient_name"],
            delivery_address=r["delivery_address"],
            latitude=float(r["lat"]),
            longitude=float(r["lng"]),
            weight=float(r["weight"]),
            total=float(r["total"]),
            created_at=r["created_at"],
        )
        for r in rows
    ]
    total_weight = float(sum(Decimal(str(r["weight"])) for r in rows))
    return ReadyDispatchSummary(
        orders=orders,
        total_weight=total_weight,
        order_count=len(orders),
    )


@router.get("/robots", response_model=List[RobotSummary])
def list_robots():
    with get_db() as (conn, cur):
        cur.execute(
            """
            SELECT
              r.id,
              r.name,
              r.status,
              (
                SELECT t.id
                FROM public.delivery_trips t
                WHERE t.robot_id = r.id AND t.status IN ('planned','in_progress')
                ORDER BY t.created_at DESC
                LIMIT 1
              ) AS current_trip_id
            FROM public.robots r
            ORDER BY r.id
            """
        )
        rows = cur.fetchall()
    return [
        RobotSummary(
            id=int(r["id"]),
            name=r["name"],
            status=r["status"],
            current_trip_id=int(r["current_trip_id"]) if r["current_trip_id"] is not None else None,
        )
        for r in rows
    ]


@router.post("/dispatch/run", response_model=DispatchRunResponse)
def run_dispatch():
    created_trip_ids: List[int] = []
    skipped_overweight_ids: List[int] = []
    deferred_count = 0

    with get_db() as (conn, cur):
        ready_rows = _fetch_ready_orders(cur, lock_for_update=True)

        skipped = [r for r in ready_rows if Decimal(str(r["weight"])) > CAPACITY_WEIGHT]
        skipped_overweight_ids = [int(r["id"]) for r in skipped]
        candidates = [r for r in ready_rows if Decimal(str(r["weight"])) <= CAPACITY_WEIGHT]

        if not candidates:
            conn.commit()
            return DispatchRunResponse(
                trips=[],
                skipped_overweight_order_ids=skipped_overweight_ids,
                deferred_order_count=0,
                message=(
                    "No orders eligible for dispatch."
                    if not skipped_overweight_ids
                    else f"{len(skipped_overweight_ids)} order(s) exceed the 200 lb robot capacity and were skipped."
                ),
            )

        # First-Fit Decreasing bin packing (candidates already sorted by weight DESC).
        bins: List[List[Dict[str, Any]]] = []
        for order in candidates:
            placed = False
            for b in bins:
                bin_weight = sum(Decimal(str(x["weight"])) for x in b)
                if len(b) < CAPACITY_ORDERS and bin_weight + Decimal(str(order["weight"])) <= CAPACITY_WEIGHT:
                    b.append(order)
                    placed = True
                    break
            if not placed:
                bins.append([order])

        cur.execute(
            """
            SELECT id, name FROM public.robots
            WHERE status = 'idle'
            ORDER BY id
            FOR UPDATE SKIP LOCKED
            """
        )
        idle_robots = cur.fetchall()

        usable_bins = bins[: len(idle_robots)]
        deferred_orders = sum(len(b) for b in bins[len(idle_robots):])
        deferred_count = deferred_orders

        for robot, bin_orders in zip(idle_robots, usable_bins):
            optimized, full_route, legs, route_optimized = _run_optimization(bin_orders)
            bin_weight = sum(Decimal(str(o["weight"])) for o in optimized)

            cur.execute(
                """
                INSERT INTO public.delivery_trips
                  (robot_id, status, order_count, total_weight, route_geojson,
                   legs_geojson, route_optimized, started_at)
                VALUES
                  (%(robot_id)s, 'in_progress', %(order_count)s, %(total_weight)s,
                   %(route_geojson)s, %(legs_geojson)s, %(route_optimized)s, now())
                RETURNING id
                """,
                {
                    "robot_id": int(robot["id"]),
                    "order_count": len(optimized),
                    "total_weight": bin_weight,
                    "route_geojson": json.dumps(full_route) if full_route else None,
                    "legs_geojson": json.dumps(legs) if legs else None,
                    "route_optimized": route_optimized,
                },
            )
            trip_id = int(cur.fetchone()["id"])
            created_trip_ids.append(trip_id)

            for seq, ord_row in enumerate(optimized, start=1):
                cur.execute(
                    """
                    UPDATE public.orders
                    SET delivery_trip_id = %(trip_id)s,
                        trip_stop_sequence = %(seq)s,
                        status = 'out_for_delivery',
                        updated_at = now()
                    WHERE id = %(order_id)s
                    """,
                    {"trip_id": trip_id, "seq": seq, "order_id": int(ord_row["id"])},
                )

            cur.execute(
                "UPDATE public.robots SET status = 'dispatched' WHERE id = %(id)s",
                {"id": int(robot["id"])},
            )

        conn.commit()

        trips_out = _load_trip_summaries(cur, created_trip_ids) if created_trip_ids else []

    message_parts: List[str] = []
    if created_trip_ids:
        message_parts.append(f"Created {len(created_trip_ids)} trip(s).")
    if skipped_overweight_ids:
        message_parts.append(
            f"Skipped {len(skipped_overweight_ids)} order(s) over 200 lbs."
        )
    if deferred_count:
        message_parts.append(
            f"Deferred {deferred_count} order(s) — no idle robots available."
        )
    if not message_parts:
        message_parts.append("No orders eligible for dispatch.")

    return DispatchRunResponse(
        trips=trips_out,
        skipped_overweight_order_ids=skipped_overweight_ids,
        deferred_order_count=deferred_count,
        message=" ".join(message_parts),
    )


def _load_trip_summaries(cur, trip_ids: List[int]) -> List[TripSummary]:
    cur.execute(
        """
        SELECT
          t.id, t.robot_id, t.status, t.order_count, t.total_weight,
          t.current_stop, t.route_optimized, t.started_at, t.completed_at, t.created_at,
          r.name AS robot_name
        FROM public.delivery_trips t
        JOIN public.robots r ON r.id = t.robot_id
        WHERE t.id = ANY(%(ids)s)
        ORDER BY t.id
        """,
        {"ids": trip_ids},
    )
    rows = cur.fetchall()
    return [_trip_summary_from_row(r) for r in rows]


@router.get("/trips", response_model=List[TripSummary])
def list_trips(status: Optional[List[str]] = Query(default=None)):
    filter_clause = ""
    params: Dict[str, Any] = {}
    if status:
        invalid = [s for s in status if s not in VALID_TRIP_STATUSES]
        if invalid:
            raise HTTPException(status_code=400, detail=f"Invalid trip status(es): {', '.join(invalid)}")
        filter_clause = "WHERE t.status = ANY(%(statuses)s)"
        params["statuses"] = list(status)

    with get_db() as (conn, cur):
        # Reconcile any trips whose simulator clock has run past their plan.
        cur.execute(
            """
            SELECT t.id, t.robot_id, t.status, t.order_count, t.current_stop,
                   t.started_at, t.legs_geojson
            FROM public.delivery_trips t
            WHERE t.status = 'in_progress'
            """
        )
        for trip_row in cur.fetchall():
            _reconcile_trip_progress(cur, trip_row)
        conn.commit()

        cur.execute(
            f"""
            SELECT
              t.id, t.robot_id, t.status, t.order_count, t.total_weight,
              t.current_stop, t.route_optimized, t.started_at, t.completed_at, t.created_at,
              r.name AS robot_name
            FROM public.delivery_trips t
            JOIN public.robots r ON r.id = t.robot_id
            {filter_clause}
            ORDER BY t.created_at DESC, t.id DESC
            """,
            params,
        )
        rows = cur.fetchall()
    return [_trip_summary_from_row(r) for r in rows]


def _load_trip_detail(cur, trip_id: int) -> TripDetail:
    cur.execute(
        """
        SELECT
          t.id, t.robot_id, t.status, t.order_count, t.total_weight,
          t.current_stop, t.route_optimized, t.started_at, t.completed_at, t.created_at,
          t.legs_geojson,
          r.name AS robot_name
        FROM public.delivery_trips t
        JOIN public.robots r ON r.id = t.robot_id
        WHERE t.id = %(id)s
        """,
        {"id": trip_id},
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Trip not found")

    row = _reconcile_trip_progress(cur, row)

    cur.execute(
        """
        SELECT
          o.id AS order_id,
          o.recipient_name,
          o.delivery_address,
          o.delivery_address_latitude AS lat,
          o.delivery_address_longitude AS lng,
          o.trip_stop_sequence,
          o.status AS order_status,
          COALESCE(SUM(oi.unit_weight * oi.quantity), 0) AS weight
        FROM public.orders o
        LEFT JOIN public.order_items oi ON oi.order_id = o.id
        WHERE o.delivery_trip_id = %(id)s
        GROUP BY o.id
        ORDER BY o.trip_stop_sequence ASC
        """,
        {"id": trip_id},
    )
    stop_rows = cur.fetchall()

    current_stop = int(row["current_stop"] or 0)
    stops = [
        TripStop(
            stop_sequence=int(s["trip_stop_sequence"]),
            order_id=int(s["order_id"]),
            recipient_name=s["recipient_name"],
            delivery_address=s["delivery_address"],
            latitude=float(s["lat"]),
            longitude=float(s["lng"]),
            weight=float(s["weight"]),
            delivered=(s["order_status"] == "delivered" or int(s["trip_stop_sequence"]) <= current_stop),
        )
        for s in stop_rows
    ]

    summary = _trip_summary_from_row(row)
    return TripDetail(**summary.model_dump(), stops=stops)


@router.get("/trips/{trip_id}", response_model=TripDetail)
def get_trip(trip_id: int):
    with get_db() as (conn, cur):
        result = _load_trip_detail(cur, trip_id)
        conn.commit()
        return result


@router.get("/trips/{trip_id}/state", response_model=TripState)
def get_trip_state(trip_id: int):
    """
    Live trip plan + clock anchor. Frontend animates locally from this.
    """
    with get_db() as (conn, cur):
        cur.execute(
            """
            SELECT
              t.id, t.robot_id, t.status, t.order_count, t.total_weight,
              t.current_stop, t.route_optimized, t.started_at, t.completed_at, t.created_at,
              t.legs_geojson,
              r.name AS robot_name
            FROM public.delivery_trips t
            JOIN public.robots r ON r.id = t.robot_id
            WHERE t.id = %(id)s
            """,
            {"id": trip_id},
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Trip not found")

        row = _reconcile_trip_progress(cur, row)

        cur.execute(
            """
            SELECT
              o.id AS order_id,
              o.recipient_name,
              o.delivery_address,
              o.delivery_address_latitude AS lat,
              o.delivery_address_longitude AS lng,
              o.trip_stop_sequence,
              o.status AS order_status,
              o.delivered_at
            FROM public.orders o
            WHERE o.delivery_trip_id = %(id)s
            ORDER BY o.trip_stop_sequence ASC
            """,
            {"id": trip_id},
        )
        stop_rows = cur.fetchall()

        conn.commit()

    legs = _parse_legs(row.get("legs_geojson"))
    current_stop = int(row["current_stop"] or 0)
    stops = [
        TripStateStop(
            stop_sequence=int(s["trip_stop_sequence"]),
            order_id=int(s["order_id"]),
            recipient_name=s["recipient_name"],
            delivery_address=s["delivery_address"],
            longitude=float(s["lng"]),
            latitude=float(s["lat"]),
            delivered=(s["order_status"] == "delivered" or int(s["trip_stop_sequence"]) <= current_stop),
            delivered_at=s.get("delivered_at"),
        )
        for s in stop_rows
    ]

    return TripState(
        trip_id=int(row["id"]),
        robot_id=int(row["robot_id"]),
        robot_name=row["robot_name"],
        status=row["status"],
        started_at=row.get("started_at"),
        completed_at=row.get("completed_at"),
        server_now=datetime.now(timezone.utc),
        speed_multiplier=SIMULATION_SPEED,
        legs=[LegPlan(**leg) for leg in legs],
        stops=stops,
        current_stop=current_stop,
        order_count=int(row["order_count"]),
    )


@router.patch("/trips/{trip_id}/status", response_model=TripStatusUpdateResponse)
def update_trip_status(trip_id: int, payload: TripStatusUpdate):
    """
    Manager override. The robot auto-advances on its own; this is only used to
    cancel a trip in flight (which sends its orders back to 'preparing').
    """
    if payload.status not in VALID_TRIP_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid trip status '{payload.status}'. Must be one of: {', '.join(sorted(VALID_TRIP_STATUSES))}",
        )

    if payload.status not in ("cancelled", "completed"):
        raise HTTPException(
            status_code=400,
            detail="Only 'cancelled' (and 'completed' as a manual override) may be set manually; trips advance automatically.",
        )

    with get_db() as (conn, cur):
        cur.execute(
            "SELECT id, robot_id, status, order_count FROM public.delivery_trips WHERE id = %(id)s FOR UPDATE",
            {"id": trip_id},
        )
        trip = cur.fetchone()
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")

        new_status = payload.status
        current = trip["status"]

        if new_status == current:
            conn.commit()
            return TripStatusUpdateResponse(trip_id=trip_id, status=current)

        if new_status == "completed":
            cur.execute(
                """
                UPDATE public.delivery_trips
                SET status = 'completed',
                    completed_at = now(),
                    current_stop = order_count
                WHERE id = %(id)s
                """,
                {"id": trip_id},
            )
            cur.execute(
                """
                UPDATE public.orders
                SET status = 'delivered',
                    delivered_at = COALESCE(delivered_at, now()),
                    updated_at = now()
                WHERE delivery_trip_id = %(id)s AND status != 'delivered'
                """,
                {"id": trip_id},
            )
            cur.execute(
                "UPDATE public.robots SET status = 'idle' WHERE id = %(id)s",
                {"id": int(trip["robot_id"])},
            )
        elif new_status == "cancelled":
            cur.execute(
                "UPDATE public.delivery_trips SET status = 'cancelled' WHERE id = %(id)s",
                {"id": trip_id},
            )
            # Cancel any orders that were on this trip and not yet delivered.
            # Trip pointers are preserved so the order's history still shows
            # which run it was cancelled out of.
            cur.execute(
                """
                UPDATE public.orders
                SET status = 'cancelled',
                    updated_at = now()
                WHERE delivery_trip_id = %(id)s AND status != 'delivered'
                """,
                {"id": trip_id},
            )
            cur.execute(
                "UPDATE public.robots SET status = 'idle' WHERE id = %(id)s",
                {"id": int(trip["robot_id"])},
            )

        conn.commit()

    return TripStatusUpdateResponse(trip_id=trip_id, status=new_status)
