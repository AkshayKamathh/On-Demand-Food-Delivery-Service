

-- PROFILES (depends on auth.users only — create first)
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  username text,
  avatar_url text,
  full_name text,
  role text NOT NULL DEFAULT 'user'::text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

-- CATEGORIES (no dependencies)
CREATE TABLE public.categories (
  category_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  description text,
  CONSTRAINT categories_pkey PRIMARY KEY (category_id)
);

-- ROBOTS (no dependencies)
CREATE TABLE public.robots (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'idle'::text CHECK (status = ANY (ARRAY['idle'::text, 'dispatched'::text, 'offline'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT robots_pkey PRIMARY KEY (id)
);

-- ITEMS (depends on categories)
CREATE TABLE public.items (
  item_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  description text,
  stock bigint NOT NULL DEFAULT 0,
  image_url text,
  category_id bigint,
  price numeric,
  weight numeric,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT items_pkey PRIMARY KEY (item_id),
  CONSTRAINT items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(category_id)
);

-- ITEM_DETAILS (depends on items)
CREATE TABLE public.item_details (
  item_id bigint NOT NULL,
  long_description text,
  nutrition jsonb,
  extra jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT item_details_pkey PRIMARY KEY (item_id),
  CONSTRAINT item_details_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(item_id)
);

-- CART_ITEMS (depends on profiles + items)
CREATE TABLE public.cart_items (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  item_id bigint NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cart_items_pkey PRIMARY KEY (id),
  CONSTRAINT cart_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT cart_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(item_id)
);

-- DELIVERY_TRIPS (depends on robots)
CREATE TABLE public.delivery_trips (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  robot_id bigint NOT NULL,
  status text NOT NULL DEFAULT 'planned'::text CHECK (status = ANY (ARRAY['planned'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])),
  order_count integer NOT NULL,
  total_weight numeric NOT NULL,
  route_geojson jsonb,
  route_optimized boolean NOT NULL DEFAULT true,
  current_stop integer NOT NULL DEFAULT 0,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  legs_geojson jsonb,
  CONSTRAINT delivery_trips_pkey PRIMARY KEY (id),
  CONSTRAINT delivery_trips_robot_id_fkey FOREIGN KEY (robot_id) REFERENCES public.robots(id)
);

-- ORDERS (depends on delivery_trips)
CREATE TABLE public.orders (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending_payment'::text CHECK (status = ANY (ARRAY['pending_payment'::text, 'submitted'::text, 'preparing'::text, 'out_for_delivery'::text, 'delivered'::text, 'cancelled'::text])),
  payment_status text NOT NULL DEFAULT 'unpaid'::text,
  stripe_checkout_session_id text UNIQUE,
  stripe_payment_intent_id text,
  subtotal numeric NOT NULL,
  delivery_fee numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL,
  currency text NOT NULL DEFAULT 'usd'::text,
  recipient_name text NOT NULL,
  email text NOT NULL,
  delivery_address text NOT NULL,
  delivery_address_latitude double precision NOT NULL,
  delivery_address_longitude double precision NOT NULL,
  delivery_notes text,
  paid_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  delivered_at timestamp with time zone,
  delivery_trip_id bigint,
  trip_stop_sequence integer,
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_delivery_trip_id_fkey FOREIGN KEY (delivery_trip_id) REFERENCES public.delivery_trips(id)
);

-- ORDER_ITEMS (depends on orders + items)
CREATE TABLE public.order_items (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  order_id bigint NOT NULL,
  item_id integer NOT NULL,
  description text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL,
  unit_weight numeric NOT NULL,
  line_total numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT order_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(item_id)
);

-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.robots         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_details   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items    ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
begin
  insert into public.profiles (id, role, updated_at)
  values (new.id, 'user', timezone('utc'::text, now()))
  on conflict (id) do nothing;
  return new;
end;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach the trigger to auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'manager'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


CREATE POLICY "Managers can update any order" ON public.orders
  FOR UPDATE USING (is_manager());
CREATE POLICY "Managers can view all orders" ON public.orders
  FOR SELECT USING (is_manager());

-- items
CREATE POLICY "Managers can manage items" ON public.items
  FOR ALL USING (is_manager());

-- Categories
CREATE POLICY "Managers can manage categories" ON public.categories
  FOR ALL USING (is_manager());

-- item item_details
CREATE POLICY "Managers can manage item details" ON public.item_details
  FOR ALL USING (is_manager());

-- robots
CREATE POLICY "Managers can manage robots" ON public.robots
  FOR ALL USING (is_manager());

-- delivery trip
CREATE POLICY "Managers can manage all delivery trips" ON public.delivery_trips
  FOR ALL USING (is_manager());

CREATE POLICY "Users can read own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

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

ALTER TABLE cart_items
ADD CONSTRAINT cart_items_user_id_item_id_key UNIQUE (user_id, item_id);


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


-- seed.sql
-- Run this AFTER schema.sql and policies.sql
-- Inserts sample items data

-- Categories (must exist before items due to FK constraint)
INSERT INTO public.categories (category_id, description) OVERRIDING SYSTEM VALUE VALUES
  (1, 'Fruits'),
  (2, 'Vegetables'),
  (3, 'Dairy & Eggs'),
  (4, 'Bakery'),
  (5, 'Meat & Seafood')
ON CONFLICT (category_id) DO NOTHING;

-- Reset category sequence so future inserts don't collide
SELECT setval(pg_get_serial_sequence('public.categories', 'category_id'), 5);

-- Items
INSERT INTO public.items (item_id, description, stock, image_url, category_id, price, weight, is_active) OVERRIDING SYSTEM VALUE VALUES
  (13, 'Organic Apples',   6,  'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=200', 1, 4.99, 1.00, true),
  (14, 'Fresh Tomatoes',   20, 'https://images.unsplash.com/photo-1582284540020-8acbe03f4924?q=80&w=870&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', 2, 3.49, 1.00, true),
  (15, 'Whole Milk',       0,  'https://images.unsplash.com/photo-1550583724-b2692b85b150?q=80&w=987&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', 3, 5.99, 3.00, true),
  (16, 'Sourdough Bread',  0,  'https://plus.unsplash.com/premium_photo-1664640733898-d5c3f71f44e1?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8c291cmRvdWdofGVufDB8fDB8fHww', 4, 6.99, 2.00, true),
  (17, 'Avocado',          29, 'https://images.unsplash.com/photo-1612506266679-606568a33215?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8YXZvY2Fkb3xlbnwwfHwwfHx8MA%3D%3D', 2, 2.29, 0.30, true),
  (18, 'Bananas',          35, 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8YmFuYW5hfGVufDB8fDB8fHww', 1, 1.49, 1.10, true),
  (19, 'Romaine Lettuce',  5,  'https://images.unsplash.com/photo-1691906470255-640353380f3d?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8cm9tYWluZSUyMGxldHR1Y2V8ZW58MHx8MHx8fDA%3D', 2, 2.99, 1.50, true),
  (20, 'Greek Yogurt',     14, 'https://images.unsplash.com/photo-1571212515416-fef01fc43637?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Z3JlZWslMjB5b2d1cnR8ZW58MHx8MHx8fDA%3D', 3, 4.49, 1.00, true),
  (21, 'Eggs (Dozen)',     0,  'https://images.unsplash.com/photo-1639194335563-d56b83f0060c?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8ZWdnc3xlbnwwfHwwfHx8MA%3D%3D', 3, 3.99, 2.50, true),
  (22, 'Chicken Breast',   1,  'https://images.unsplash.com/photo-1682991136736-a2b44623eeba?q=80&w=2231&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', 5, 8.99, 2.00, true),
  (23, 'Salmon Fillet',    13, 'https://plus.unsplash.com/premium_photo-1726873263849-cb94e5c1c065?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', 5, 12.99, 0.80, true),
  (24, 'Ground Beef',      15, 'https://plus.unsplash.com/premium_photo-1670357599582-de7232e949a0?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NXx8Z3JvdW5kJTIwYmVlZnxlbnwwfHwwfHx8MA%3D%3D', 5, 8.49, 1.00, true),
  (26, 'Giant Watermelon', 54, 'https://lzxkaqiapemgcihcegii.supabase.co/storage/v1/object/public/product-images/products/1777271147594-strawberry.jpg', 1, 100.00, 100.00, true)
ON CONFLICT (item_id) DO NOTHING;

-- Reset item sequence so future inserts start after 26
SELECT setval(pg_get_serial_sequence('public.items', 'item_id'), 26);


INSERT INTO public.robots (name, status) VALUES
  ('Robot 1', 'idle'),
  ('Robot 2', 'idle');