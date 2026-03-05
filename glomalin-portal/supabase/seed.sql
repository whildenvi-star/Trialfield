-- Glomalin Portal: Seed Data
-- Run AFTER schema.sql and AFTER creating a test user via Supabase Auth
--
-- Steps:
-- 1. Apply schema.sql in Supabase SQL Editor
-- 2. Create a test user in Supabase Auth > Users > Add User (email: admin@glomalin.local)
-- 3. Copy the user's UUID from Supabase Auth
-- 4. Replace 'YOUR_USER_UUID_HERE' below with the actual UUID
-- 5. Run this seed in Supabase SQL Editor

-- Promote test user to admin
update profiles
set role = 'admin', full_name = 'Admin User'
where id = 'YOUR_USER_UUID_HERE';

-- Grant module access for all 5 modules
insert into module_access (user_id, module, granted) values
  ('YOUR_USER_UUID_HERE', 'macro-rollup', true),
  ('YOUR_USER_UUID_HERE', 'farm-registry', true),
  ('YOUR_USER_UUID_HERE', 'org-cert', true),
  ('YOUR_USER_UUID_HERE', 'inputs-seeds', true),
  ('YOUR_USER_UUID_HERE', 'fsa-reporting', true);
