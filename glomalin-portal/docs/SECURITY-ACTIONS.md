# Security actions — operator only

These cannot be done from a code change. They need access to the droplet, the
Supabase project, or GitHub repository settings.

## 1. Rotate `EMBED_TOKEN` — do this first

`farm-registry/.env` and `meristem-malt/.env` were committed to
`whildenvi-star/Trialfield`, which is **public**. They are no longer tracked at HEAD
and `.gitignore` now covers them, but **they remain in git history** — reachable from
commit `1ea9c98` and earlier. Anyone who has cloned the repo has the token.

That one token is the only credential protecting:

- the `embed_session` cookie trusted by farm-budget, seed-inventory, farm-registry and
  grain-tickets (`api/mobile/_lib/proxy.ts`) — no user identity is sent on those calls
- `POST /api/fsa/webhook/field-created`, which writes with the service-role key and
  bypasses RLS

**Treat the current value as burned.** Removing the files did not invalidate it.

Steps:

1. Generate a new token: `openssl rand -hex 32`
2. Update `EMBED_TOKEN` in every service's `.env` on the droplet: glomalin-portal,
   farm-registry, meristem-malt, farm-budget, seed-inventory, grain-tickets
3. `pm2 restart all`
4. Confirm the embedded modules still load and the field-created webhook still fires

Rotation alone closes the exposure. The history purge below is cleanup, not the fix.

## 2. Purge the files from git history — needs a decision

The secrets stay readable in history until it is rewritten:

```
git filter-repo --path farm-registry/.env --path meristem-malt/.env --invert-paths
git push --force --all
```

**This rewrites public history and breaks every existing clone**, including any
in-flight branches. Do it deliberately, when nobody else is mid-work, and after
rotation — never instead of rotation. Forks and prior clones keep the old value
regardless, which is why step 1 is the actual remedy.

Worth deciding at the same time whether this repository should be public at all.

## 3. Stop sending the token in URLs

`lib/modules.ts:38-41` appends `?token=<EMBED_TOKEN>` to embed iframe URLs, and
`app/[module]/page.tsx` is a Server Component — so the token is rendered into the HTML
sent to every authenticated user, including a `viewer`, and lands in browser history,
`Referer` headers and Caddy access logs.

The webhook now accepts `Authorization: Bearer` (migration in this branch). The embed
path still needs the same treatment; the query parameter is retained only for the
existing farm-registry caller and should be retired once that caller is updated.

## 4. Still open, not addressed by this branch

- **Middleware extension bypass.** `middleware.ts` returns `NextResponse.next()` for any
  path ending `.js`, `.css`, `.json`, `.ico`, `.svg`, `.png`, `.jpg`, `.webp` — before
  `getUser()` runs. Dynamic `[id]` routes accept those suffixes, so the invariant the
  `cert-proxy` handlers document as their basis for using unverified `getSession()` does
  not hold.
- **Recursive RLS policies.** `profiles_admin_all` selects from `profiles` inside a
  policy on `profiles` (42P17). Migration 037 adds `current_user_role()`, a
  SECURITY DEFINER helper that these policies could be rewritten against — but it does
  not rewrite them, because the live policy set has diverged from source control and
  overwriting a hand-applied fix would be worse. Dump the live policies first.
