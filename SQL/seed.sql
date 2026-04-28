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