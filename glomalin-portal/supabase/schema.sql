-- Glomalin Portal: Supabase Schema
-- Apply via Supabase Dashboard > SQL Editor
-- After applying, run seed.sql for test data

-- 1. Role enum
create type user_role as enum ('admin', 'agronomist', 'operator', 'viewer');

-- 2. Profiles table (FK to auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'viewer',
  full_name text,
  cert_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Module access table
create table module_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  module text not null,
  granted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, module)
);

-- 4. Enable RLS
alter table profiles enable row level security;
alter table module_access enable row level security;

-- 5. RLS policies for profiles
create policy profiles_select_own on profiles
  for select using (auth.uid() = id);

create policy profiles_update_own on profiles
  for update using (auth.uid() = id);

create policy profiles_admin_all on profiles
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- 6. RLS policies for module_access
create policy module_access_select_own on module_access
  for select using (auth.uid() = user_id);

create policy module_access_admin_all on module_access
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy module_access_admin_manage on module_access
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- 7. Auto-profile trigger function
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, role)
  values (new.id, 'viewer');
  return new;
end;
$$ language plpgsql security definer;

-- 8. Trigger binding
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 9. Updated_at trigger function
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

create trigger module_access_updated_at
  before update on module_access
  for each row execute function set_updated_at();
