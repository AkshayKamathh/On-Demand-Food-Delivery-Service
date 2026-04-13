CREATE TABLE IF NOT EXISTS public.orders (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_payment',
    payment_status TEXT NOT NULL DEFAULT 'unpaid',
    stripe_checkout_session_id TEXT UNIQUE,
    stripe_payment_intent_id TEXT,
    subtotal NUMERIC(10, 2) NOT NULL,
    delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total NUMERIC(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'usd',
    recipient_name TEXT NOT NULL,
    email TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    delivery_address_latitude DOUBLE PRECISION NOT NULL,
    delivery_address_longitude DOUBLE PRECISION NOT NULL,
    delivery_notes TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES public.items(item_id),
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL,
    unit_weight NUMERIC(10, 2) NOT NULL,
    line_total NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
