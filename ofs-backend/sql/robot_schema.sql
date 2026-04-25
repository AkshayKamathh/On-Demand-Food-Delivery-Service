-- Robot fleet + delivery trip aggregation for multi-stop dispatch.
-- Apply manually to Supabase (matches the existing checkout_schema.sql workflow).

CREATE TABLE IF NOT EXISTS public.robots (
    id         BIGSERIAL PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    status     TEXT NOT NULL DEFAULT 'idle'
               CHECK (status IN ('idle', 'dispatched', 'offline')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivery_trips (
    id              BIGSERIAL PRIMARY KEY,
    robot_id        BIGINT NOT NULL REFERENCES public.robots(id),
    status          TEXT NOT NULL DEFAULT 'planned'
                    CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
    order_count     INTEGER NOT NULL,
    total_weight    NUMERIC(10, 2) NOT NULL,
    route_geojson   JSONB,
    legs_geojson    JSONB,  -- array of {coordinates:[[lng,lat],...], duration_s:number, distance_m:number}, leg i = restaurant->stop1 (i=0) or stop_i->stop_{i+1}
    route_optimized BOOLEAN NOT NULL DEFAULT TRUE,
    current_stop    INTEGER NOT NULL DEFAULT 0,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- For previously-created tables.
ALTER TABLE public.delivery_trips
    ADD COLUMN IF NOT EXISTS legs_geojson JSONB;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS delivery_trip_id   BIGINT REFERENCES public.delivery_trips(id),
    ADD COLUMN IF NOT EXISTS trip_stop_sequence INTEGER;

CREATE INDEX IF NOT EXISTS idx_orders_delivery_trip_id    ON public.orders(delivery_trip_id);
CREATE INDEX IF NOT EXISTS idx_delivery_trips_robot_status ON public.delivery_trips(robot_id, status);

INSERT INTO public.robots (name) VALUES
    ('Apollo'),
    ('Bolt'),
    ('Comet')
ON CONFLICT (name) DO NOTHING;
