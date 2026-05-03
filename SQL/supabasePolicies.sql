
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