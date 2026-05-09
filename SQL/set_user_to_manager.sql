-- To set your first user to manager, run this query:
-- Replace 'your@email.com' with the email of the user you want to set to manager
UPDATE public.profiles
SET role = 'manager'
WHERE email = 'your@email.com';
-- afterwards, in the manager dashboard, you can promote other users
-- to manager by searching for their email and clicking the "Set as Manager" button