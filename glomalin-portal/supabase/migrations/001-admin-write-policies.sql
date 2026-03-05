-- Run in Supabase SQL Editor after schema.sql
-- Adds admin write policy for profiles table (UPDATE)
-- The module_access_admin_manage policy in schema.sql already covers ALL operations on module_access.

-- Allow admins to update any user's role
create policy profiles_admin_update on profiles
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
