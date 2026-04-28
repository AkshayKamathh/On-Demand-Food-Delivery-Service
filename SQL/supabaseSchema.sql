-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

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
CREATE TABLE public.categories (
  category_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  description text,
  CONSTRAINT categories_pkey PRIMARY KEY (category_id)
);
CREATE TABLE public.delivery_trips (
  id bigint NOT NULL DEFAULT nextval('delivery_trips_id_seq'::regclass),
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
CREATE TABLE public.item_details (
  item_id bigint NOT NULL,
  long_description text,
  nutrition jsonb,
  extra jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT item_details_pkey PRIMARY KEY (item_id),
  CONSTRAINT item_details_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(item_id)
);
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
CREATE TABLE public.order_items (
  id bigint NOT NULL DEFAULT nextval('order_items_id_seq'::regclass),
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
CREATE TABLE public.orders (
  id bigint NOT NULL DEFAULT nextval('orders_id_seq'::regclass),
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
CREATE TABLE public.robots (
  id bigint NOT NULL DEFAULT nextval('robots_id_seq'::regclass),
  name text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'idle'::text CHECK (status = ANY (ARRAY['idle'::text, 'dispatched'::text, 'offline'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT robots_pkey PRIMARY KEY (id)
);