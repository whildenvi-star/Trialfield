-- Migration 037: prevent privilege escalation via profiles.role
--
-- PROBLEM
-- schema.sql defines:
--     create policy profiles_update_own on profiles
--       for update using (auth.uid() = id);
-- with no WITH CHECK clause. When WITH CHECK is omitted, PostgreSQL reuses the
-- USING expression as the check. Updating your own `role` does not change `id`,
-- so `auth.uid() = id` holds both before and after — and the write is allowed.
--
-- Any authenticated user can therefore run, from the browser with the public
-- anon key:
--     supabase.from('profiles').update({ role: 'admin' }).eq('id', myUserId)
-- and become an admin. profiles.role gates /admin (middleware.ts), every
-- /api/admin/* route, and the admin bypass in requireModuleAccess().
--
-- WHY A TRIGGER AND NOT A POLICY
-- WITH CHECK can only see the NEW row, so it cannot express "role is unchanged".
-- Expressing it as a subquery over profiles would re-enter that table's own RLS
-- and hit the existing infinite-recursion problem (42P17). A BEFORE UPDATE
-- trigger sees both OLD and NEW and sidesteps both issues.
--
-- Deliberately NOT changing any existing policy. The committed schema is known
-- to have diverged from production, so dropping and recreating policies here
-- risks clobbering a hand-applied fix that is not in source control. This
-- migration only adds; it removes nothing.

-- ── Helper: the caller's role, read without re-entering profiles RLS ─────────
-- SECURITY DEFINER runs as the function owner, so the profiles policies do not
-- apply to this read and no recursion occurs. search_path is pinned so the
-- function cannot be redirected by a caller-controlled search_path.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_user_role() FROM public;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

-- ── Guard: only admins (or server-side service-role code) may change the
--    privileged columns on a profile ────────────────────────────────────────
-- auth.uid() is NULL on a service-role connection, which is how trusted
-- server-side code (admin invite provisioning) is allowed through.
CREATE OR REPLACE FUNCTION public.profiles_guard_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Service role / internal: no end-user identity, already trusted.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     AND public.current_user_role() IS DISTINCT FROM 'admin'::user_role THEN
    RAISE EXCEPTION 'profiles.role may only be changed by an admin'
      USING ERRCODE = '42501';
  END IF;

  -- cert_user_id maps a portal user onto an organic-cert identity. Letting a
  -- user rewrite their own would let them act as someone else in that service.
  IF NEW.cert_user_id IS DISTINCT FROM OLD.cert_user_id
     AND public.current_user_role() IS DISTINCT FROM 'admin'::user_role THEN
    RAISE EXCEPTION 'profiles.cert_user_id may only be changed by an admin'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_privileged_columns ON public.profiles;
CREATE TRIGGER profiles_guard_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_privileged_columns();

-- Admins keep changing roles through /api/admin/users/[id]/role, which uses the
-- caller's own session: that caller is verified admin in the route AND passes
-- current_user_role() here. /api/admin/invite uses the service-role client and
-- is exempt via the auth.uid() IS NULL branch above. No application code change
-- is required by this migration.
