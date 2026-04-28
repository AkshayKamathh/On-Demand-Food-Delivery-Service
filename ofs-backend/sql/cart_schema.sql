CREATE TABLE IF NOT EXISTS public.cart_items (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    item_id INTEGER NOT NULL REFERENCES public.items(item_id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON public.cart_items(user_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'cart_items_quantity_positive'
    ) THEN
        ALTER TABLE public.cart_items
            ADD CONSTRAINT cart_items_quantity_positive
            CHECK (quantity > 0);
    END IF;
END $$;
