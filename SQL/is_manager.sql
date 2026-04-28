CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'manager'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;