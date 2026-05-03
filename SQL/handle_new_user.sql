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