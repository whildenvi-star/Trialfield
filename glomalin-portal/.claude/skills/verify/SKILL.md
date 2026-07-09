---
name: verify
description: Runtime-verify glomalin-portal changes by driving the real app headless against prod Supabase with a temp admin user and disposable test data.
---

# Verify glomalin-portal changes

The portal has no local Supabase — `npm run dev` talks to **prod** via `.env.local`.
Verification therefore uses a temp admin user + clearly-named disposable rows
(e.g. farm_number `TEST-VRFY`), all deleted afterward.

## Build & launch

```bash
cd glomalin-portal
npm run dev -- --port 3010   # background; ready when GET /login → 200
```

## Auth handle (no shared credentials needed)

`SUPABASE_SERVICE_ROLE_KEY` is in `glomalin-portal/.env.local`. Use the GoTrue
admin API + PostgREST directly:

1. `POST {SUPABASE_URL}/auth/v1/admin/users` with `{email, password, email_confirm: true}`
2. `POST /rest/v1/profiles` with `{id: <user.id>, role: 'admin', full_name: ...}`
   (Prefer: resolution=merge-duplicates). **admin role bypasses all module_access checks.**
3. Log in via Playwright at `/login` (`input[name=email]`, `input[name=password]`, submit).
4. Delete the user + profile row when done.

Gotchas:
- `profiles` has NO email column (id, role, full_name, cert_user_id only).
- `clu_records.legacy_id` is NOT NULL in prod — seed scripts must set it.
- The Supabase MCP is **read-only** (fine for SELECT checks); all writes go
  through PostgREST/GoTrue with the service key, DDL via `supabase db push`
  (CLI is linked; migration files must use unique version prefixes — history
  PK is version-only).

## Seeding map-visible CLUs

The reporting map only shows CLUs that have a matching `clu_boundaries` row
(farm_number + tract_number + clu_label/clu + crop_year). Insert boundaries as
EWKT strings via PostgREST (`SRID=4326;POLYGON((...))`) placed near the real
farm cluster (~ -89.10, 42.61) so zoom behavior stays sane. Then insert
matching `clu_records` (remember `legacy_id`).

## Driving the compliance map

- URL: `/app/compliance?tab=acreage` (map view is the default).
- **Wait ~6s after the sidebar renders before clicking a farm** — the map's
  initial auto-zoom fires after a second fetch (anomalies) and will stomp any
  earlier flyTo.
- Sidebar tree: `text=Farm <n>` expands + flies; `text=Tract <n>` expands;
  CLU checkboxes have `aria-label="Select CLU <n>"`; tract/farm select-alls
  have `aria-label="Select all CLUs in ..."`.
- Playwright is not a project dep — `npm i playwright` in the session
  scratchpad; chromium is usually already in `~/Library/Caches/ms-playwright`.
- Authenticated API checks: `page.evaluate(() => fetch('/api/...'))` reuses
  the session cookie (e.g. the 578 CSV export).

## Cleanup (always)

Delete in order: `clu_records?farm_number=eq.TEST-VRFY`, `clu_boundaries?...`,
`module_access?user_id=eq.<id>`, `profiles?id=eq.<id>`, then
`DELETE /auth/v1/admin/users/<id>`. Verify with a SELECT count. Stop the dev server.
