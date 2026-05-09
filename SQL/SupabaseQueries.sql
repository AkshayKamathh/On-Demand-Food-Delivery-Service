-- PROFILES (depends on auth.users only — create first)
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  username text,
  avatar_url text,
  email text,
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
  CONSTRAINT cart_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(item_id),
  CONSTRAINT cart_items_user_id_item_id_key UNIQUE (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON public.cart_items(user_id);

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

CREATE INDEX IF NOT EXISTS idx_delivery_trips_robot_status ON public.delivery_trips(robot_id, status);

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

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_trip_id ON public.orders(delivery_trip_id);

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
  CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE,
  CONSTRAINT order_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(item_id)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);


-- ============================================================
-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================
ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.robots         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_details   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items    ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- TRIGGER: auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, role, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'username',
    'user',
    timezone('utc'::text, now())
  )
  ON CONFLICT (id) DO UPDATE
    SET email    = EXCLUDED.email,
        username = COALESCE(EXCLUDED.username, public.profiles.username);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach the trigger to auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- HELPER: manager role check
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'manager'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ============================================================
-- ROLE MANAGEMENT FUNCTIONS
-- ============================================================

-- Search profiles by email (managers only)
CREATE OR REPLACE FUNCTION public.search_profiles_by_email(search_email text)
RETURNS TABLE (id uuid, email text, username text, role text)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT p.id, p.email, p.username, p.role
  FROM public.profiles p
  WHERE p.email ILIKE '%' || search_email || '%'
    AND is_manager()
  LIMIT 10;
$$;

-- Promote or demote a user's role (managers only)
CREATE OR REPLACE FUNCTION public.set_user_role(target_user_id uuid, new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_manager() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF new_role NOT IN ('user', 'manager') THEN
    RAISE EXCEPTION 'Invalid role: must be ''user'' or ''manager''';
  END IF;
  UPDATE public.profiles SET role = new_role WHERE id = target_user_id;
END;
$$;


-- ============================================================
-- RLS POLICIES
-- ============================================================

-- profiles
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- orders
CREATE POLICY "Managers can update any order" ON public.orders
  FOR UPDATE USING (is_manager());

CREATE POLICY "Managers can view all orders" ON public.orders
  FOR SELECT USING (is_manager());

CREATE POLICY "Users can view own orders" ON public.orders
  FOR SELECT USING (auth.uid() = user_id);

-- items
CREATE POLICY "Managers can manage items" ON public.items
  FOR ALL USING (is_manager());

CREATE POLICY "Anyone can view active items" ON public.items
  FOR SELECT USING (is_active = true);

-- categories
CREATE POLICY "Managers can manage categories" ON public.categories
  FOR ALL USING (is_manager());

CREATE POLICY "Anyone can view categories" ON public.categories
  FOR SELECT USING (true);

-- item_details
CREATE POLICY "Managers can manage item details" ON public.item_details
  FOR ALL USING (is_manager());

CREATE POLICY "Anyone can view item details" ON public.item_details
  FOR SELECT USING (true);

-- robots
CREATE POLICY "Managers can manage robots" ON public.robots
  FOR ALL USING (is_manager());

-- delivery_trips
CREATE POLICY "Managers can manage all delivery trips" ON public.delivery_trips
  FOR ALL USING (is_manager());

-- cart_items
CREATE POLICY "Users can manage own cart" ON public.cart_items
  FOR ALL USING (auth.uid() = user_id);

-- order_items
CREATE POLICY "Users can view own order items" ON public.order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
        AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Managers can manage order items" ON public.order_items
  FOR ALL USING (is_manager());


-- ============================================================
-- SEED DATA
-- ============================================================

-- Categories
INSERT INTO public.categories (category_id, description) OVERRIDING SYSTEM VALUE VALUES
  (1, 'Fruits'),
  (2, 'Vegetables'),
  (3, 'Dairy & Eggs'),
  (4, 'Bakery'),
  (5, 'Meat & Seafood')
ON CONFLICT (category_id) DO NOTHING;

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

SELECT setval(pg_get_serial_sequence('public.items', 'item_id'), 26);

-- Item Details
INSERT INTO public.item_details (item_id, long_description, nutrition, extra)
VALUES
  (
    13,
    'Crisp, hand-picked organic apples grown without synthetic pesticides or fertilizers. Perfect for snacking, baking, or adding to salads.',
    '{"serving_size":"1 medium apple (182g)","calories":95,"total_fat_g":0.3,"saturated_fat_g":0,"cholesterol_mg":0,"sodium_mg":2,"total_carbs_g":25,"dietary_fiber_g":4.4,"sugars_g":19,"protein_g":0.5,"vitamin_c_mg":8.4,"potassium_mg":195}'::jsonb,
    '{"storage":"Refrigerate for up to 4 weeks","origin":"USA","organic":true}'::jsonb
  ),
  (
    14,
    'Vine-ripened fresh tomatoes bursting with flavor. Great for salads, sandwiches, sauces, or slicing.',
    '{"serving_size":"1 medium tomato (123g)","calories":22,"total_fat_g":0.2,"saturated_fat_g":0,"cholesterol_mg":0,"sodium_mg":6,"total_carbs_g":4.8,"dietary_fiber_g":1.5,"sugars_g":3.2,"protein_g":1.1,"vitamin_c_mg":17,"potassium_mg":292}'::jsonb,
    '{"storage":"Store at room temperature until ripe, then refrigerate","origin":"USA"}'::jsonb
  ),
  (
    15,
    'Fresh whole milk with no added hormones. Rich, creamy, and packed with essential vitamins and calcium for the whole family.',
    '{"serving_size":"1 cup (240ml)","calories":149,"total_fat_g":8,"saturated_fat_g":4.6,"cholesterol_mg":24,"sodium_mg":105,"total_carbs_g":12,"dietary_fiber_g":0,"sugars_g":12,"protein_g":8,"calcium_mg":276,"vitamin_d_iu":124}'::jsonb,
    '{"storage":"Keep refrigerated at or below 40°F","allergens":["milk"]}'::jsonb
  ),
  (
    16,
    'Artisan sourdough bread made with a traditional slow-fermented starter. Features a tangy flavor and chewy, open crumb with a crispy golden crust.',
    '{"serving_size":"1 slice (64g)","calories":170,"total_fat_g":1,"saturated_fat_g":0,"cholesterol_mg":0,"sodium_mg":350,"total_carbs_g":33,"dietary_fiber_g":1.5,"sugars_g":1,"protein_g":7,"iron_mg":2.5}'::jsonb,
    '{"storage":"Store at room temperature up to 3 days or freeze for longer","allergens":["wheat"]}'::jsonb
  ),
  (
    17,
    'Creamy Hass avocados, perfect for guacamole, toast, salads, or smoothies. Packed with healthy monounsaturated fats.',
    '{"serving_size":"1/3 medium avocado (50g)","calories":80,"total_fat_g":7,"saturated_fat_g":1,"cholesterol_mg":0,"sodium_mg":0,"total_carbs_g":4,"dietary_fiber_g":3,"sugars_g":0.3,"protein_g":1,"potassium_mg":250}'::jsonb,
    '{"storage":"Ripen at room temperature, refrigerate once ripe","origin":"Mexico"}'::jsonb
  ),
  (
    18,
    'Sweet, naturally portioned bananas. A convenient on-the-go snack loaded with potassium and natural energy.',
    '{"serving_size":"1 medium banana (118g)","calories":105,"total_fat_g":0.4,"saturated_fat_g":0.1,"cholesterol_mg":0,"sodium_mg":1,"total_carbs_g":27,"dietary_fiber_g":3.1,"sugars_g":14,"protein_g":1.3,"potassium_mg":422,"vitamin_b6_mg":0.4}'::jsonb,
    '{"storage":"Store at room temperature; refrigerate to slow ripening","origin":"Guatemala"}'::jsonb
  ),
  (
    19,
    'Crisp, fresh romaine lettuce with long sturdy leaves. Ideal for Caesar salads, wraps, and sandwiches.',
    '{"serving_size":"1 cup shredded (47g)","calories":8,"total_fat_g":0.1,"saturated_fat_g":0,"cholesterol_mg":0,"sodium_mg":4,"total_carbs_g":1.5,"dietary_fiber_g":1,"sugars_g":0.6,"protein_g":0.6,"vitamin_a_iu":4094,"vitamin_k_mcg":48.2}'::jsonb,
    '{"storage":"Refrigerate unwashed in a plastic bag for up to 7 days","origin":"USA"}'::jsonb
  ),
  (
    20,
    'Thick, creamy Greek yogurt made by straining out excess whey. High in protein and probiotics for a healthy gut.',
    '{"serving_size":"1 container (170g)","calories":100,"total_fat_g":0.7,"saturated_fat_g":0.5,"cholesterol_mg":10,"sodium_mg":60,"total_carbs_g":6,"dietary_fiber_g":0,"sugars_g":6,"protein_g":17,"calcium_mg":187}'::jsonb,
    '{"storage":"Keep refrigerated; consume by date on package","allergens":["milk"]}'::jsonb
  ),
  (
    21,
    'One dozen large eggs from cage-free hens. Versatile kitchen staple for breakfast, baking, and cooking.',
    '{"serving_size":"1 large egg (50g)","calories":70,"total_fat_g":5,"saturated_fat_g":1.5,"cholesterol_mg":185,"sodium_mg":70,"total_carbs_g":0,"dietary_fiber_g":0,"sugars_g":0,"protein_g":6,"vitamin_d_iu":41,"choline_mg":147}'::jsonb,
    '{"storage":"Refrigerate and use within 3 weeks of purchase","allergens":["eggs"],"count":12}'::jsonb
  ),
  (
    22,
    'Boneless, skinless chicken breast — a lean, high-protein cut perfect for grilling, baking, stir-frying, or meal prep.',
    '{"serving_size":"4 oz raw (113g)","calories":120,"total_fat_g":2.5,"saturated_fat_g":0.5,"cholesterol_mg":70,"sodium_mg":75,"total_carbs_g":0,"dietary_fiber_g":0,"sugars_g":0,"protein_g":26,"iron_mg":0.4}'::jsonb,
    '{"storage":"Refrigerate and use within 2 days, or freeze up to 9 months","allergens":[]}'::jsonb
  ),
  (
    23,
    'Premium Atlantic salmon fillet, rich in omega-3 fatty acids. Ideal for pan-searing, baking, or grilling.',
    '{"serving_size":"4 oz raw (113g)","calories":180,"total_fat_g":10,"saturated_fat_g":2,"cholesterol_mg":55,"sodium_mg":50,"total_carbs_g":0,"dietary_fiber_g":0,"sugars_g":0,"protein_g":22,"omega3_mg":1800,"vitamin_d_iu":400}'::jsonb,
    '{"storage":"Refrigerate and cook within 1-2 days, or freeze immediately","allergens":["fish"]}'::jsonb
  ),
  (
    24,
    'Freshly ground beef (80/20 lean-to-fat ratio). Perfect for burgers, tacos, meatballs, and bolognese.',
    '{"serving_size":"4 oz raw (113g)","calories":280,"total_fat_g":22,"saturated_fat_g":8.5,"cholesterol_mg":80,"sodium_mg":75,"total_carbs_g":0,"dietary_fiber_g":0,"sugars_g":0,"protein_g":19,"iron_mg":2.4,"zinc_mg":5.3}'::jsonb,
    '{"storage":"Refrigerate and use within 1-2 days, or freeze up to 4 months","allergens":[]}'::jsonb
  ),
  (
    26,
    'A massive, show-stopping watermelon perfect for parties, cookouts, and feeding a crowd. Sweet, juicy, and refreshing.',
    '{"serving_size":"2 cups diced (280g)","calories":84,"total_fat_g":0.4,"saturated_fat_g":0,"cholesterol_mg":0,"sodium_mg":3,"total_carbs_g":21,"dietary_fiber_g":1.1,"sugars_g":17,"protein_g":1.7,"vitamin_c_mg":23,"lycopene_mg":12.7}'::jsonb,
    '{"storage":"Store whole at room temperature; refrigerate after cutting","origin":"USA"}'::jsonb
  );

-- Robots
INSERT INTO public.robots (name, status) VALUES
  ('Apollo', 'idle'),
  ('Bolt',   'idle'),
  ('Comet',  'idle'),
  ('Robot 1', 'idle'),
  ('Robot 2', 'idle')
ON CONFLICT (name) DO NOTHING;


-- ============================================================
-- CONTACT INQUIRIES
-- ============================================================
CREATE TABLE public.contact_inquiries (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  sender_email text NOT NULL,
  sender_username text,
  subject text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contact_inquiries_pkey PRIMARY KEY (id),
  CONSTRAINT contact_inquiries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

ALTER TABLE public.contact_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own inquiry"
  ON public.contact_inquiries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Managers can view all inquiries"
  ON public.contact_inquiries FOR SELECT
  USING (is_manager());

CREATE POLICY "Managers can update any inquiry"
  ON public.contact_inquiries FOR UPDATE
  USING (is_manager());

CREATE POLICY "Managers can delete any inquiry"
  ON public.contact_inquiries FOR DELETE
  USING (is_manager());


-- ============================================================
-- STORAGE: Avatar upload policies
-- ============================================================

CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public avatar read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');


-- ============================================================
-- INITIAL SETUP: Run this after your first signup to grant
-- yourself manager access. Replace with your actual email.
-- ============================================================
-- UPDATE public.profiles SET role = 'manager' WHERE email = 'your@email.com';