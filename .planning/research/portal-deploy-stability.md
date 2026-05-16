# Portal Deploy Stability — Research

**Researched:** 2026-05-08
**Domain:** Next.js 14 production deployment via PM2 + rsync on 1GB DigitalOcean droplet
**Confidence:** HIGH (direct file inspection + official docs + PM2 docs)

---

## Summary

The glomalin-portal crash-loop has two distinct failure modes that must both be fixed. First,
`sync-code.sh` excludes `.next` via `.rsyncignore` — if a developer runs this script without
subsequently rebuilding, the server has source code but no build artifacts, and PM2 crash-loops
forever. Second, the ecosystem.config.js already has `max_restarts: 10` and `restart_delay: 5000`,
meaning if PM2 was started ad-hoc (as reported, 1706 restarts) it bypassed the ecosystem config
entirely. The permanent fix has two parts: (1) make `deploy.sh` the only sanctioned deploy path for
the portal by adding a pre-flight `.next` check, and (2) replace ad-hoc PM2 `start` with
`pm2 start ecosystem.config.js` from a committed config.

The path-patching requirement (step 4 of the 7-step workflow) is already solved: the current
production build bakes `/srv/farm-ops/glomalin-portal` into the client-reference-manifests, which
means the build was done on the server (or patched correctly). The `deploy.sh` script builds on the
server with `NODE_OPTIONS='--max-old-space-size=1536'` — this is the correct workflow and should be
the only portal deploy path.

**Primary recommendation:** Enforce server-side builds for glomalin-portal. Lock `sync-code.sh` out
of `.next` (already done), update `deploy.sh` to add a post-build `.next` presence check before
restarting PM2, and add `min_uptime` + `exp_backoff_restart_delay` to the ecosystem config.

---

## Root Cause Chain

### Why 1706 Restarts Happen

```
PM2 started ad-hoc (not from ecosystem.config.js)
  → No max_restarts, no restart_delay in the ad-hoc process
  → next start exits immediately: ".next directory not found"
  → PM2 autorestart=true → immediate restart
  → 1706 times in minutes
```

The ecosystem.config.js (committed at project root) already has `max_restarts: 10` and
`restart_delay: 5000`. The ad-hoc start command (`pm2 start npm --name glomalin-portal -- start`)
IGNORES the ecosystem config entirely. This is a process discipline problem: whoever starts PM2
must use `pm2 start ecosystem.config.js`, not a manual command.

### Why .next Goes Missing

The `.rsyncignore` file correctly excludes `.next` to prevent overwriting a production build.
`sync-code.sh` uses this file. If someone runs `sync-code.sh` to push a code change and then
forgets to rebuild, the server has new source but old or no `.next`. The server-side build in
`deploy.sh` is the right answer — it rebuilds after syncing.

### Why Path-Patching Was Needed (Historical Context)

When Next.js builds with the App Router and RSC, `_client-reference-manifest.js` files contain
absolute paths to source files and node_modules. Example from current production build:

```
/srv/farm-ops/glomalin-portal/src/components/farm-node-map.tsx
/srv/farm-ops/glomalin-portal/node_modules/next/dist/client/link.js
```

If built on Mac (`/Users/glomalinguild/Desktop/my-project-one/glomalin-portal/...`), the server
at `/srv/farm-ops/glomalin-portal/...` gets wrong paths → "Could not find module in React Client
Manifest" 500 errors. The current `deploy.sh` avoids this by building on the server. The old
7-step workflow (build locally, rsync `.next`, patch paths) is now superseded.

---

## Current State of ecosystem.config.js

The file exists at `/Users/glomalinguild/Desktop/my-project-one/ecosystem.config.js`. Current
glomalin-portal config:

```js
{
  name: 'glomalin-portal',
  script: 'node_modules/.bin/next',
  args: 'start',
  cwd: './glomalin-portal',
  env: { NODE_ENV: 'production', PORT: 3000 },
  instances: 1,
  autorestart: true,
  max_restarts: 10,
  restart_delay: 5000,
  watch: false,
  max_memory_restart: '512M',
}
```

**What's missing:**
- No `min_uptime` — PM2 defaults to 1000ms, meaning a process that lives 1s counts as "stable"
  and the `max_restarts` counter resets. With `.next` missing, `next start` exits in ~200ms, so
  max_restarts IS being enforced correctly. But if PM2 was started ad-hoc, this config is moot.
- No `exp_backoff_restart_delay` — not critical but reduces thrashing pressure on the 1GB RAM.
- No `listen_timeout` — PM2 doesn't know how long a Next.js cold start takes on this droplet.

---

## Prescriptive Fixes

### Fix 1: ecosystem.config.js — Add Missing Fields

```js
// ecosystem.config.js — glomalin-portal entry
{
  name: 'glomalin-portal',
  script: 'node_modules/.bin/next',
  args: 'start',
  cwd: './glomalin-portal',
  env: {
    NODE_ENV: 'production',
    PORT: 3000,
    HOSTNAME: '0.0.0.0',
  },
  instances: 1,
  autorestart: true,
  max_restarts: 10,          // stop after 10 consecutive unstable restarts
  min_uptime: '10s',         // must live 10s to count as stable; resets counter
  exp_backoff_restart_delay: 100,  // 100ms → 150ms → 225ms → ... → 15s max
  watch: false,
  max_memory_restart: '512M',
  listen_timeout: 30000,     // 30s for Next.js cold start on 1GB droplet
  kill_timeout: 5000,
  error_file: '/var/log/farm-ops/glomalin-portal-error.log',
  out_file: '/var/log/farm-ops/glomalin-portal-out.log',
}
```

Same changes for `organic-cert` (same failure class):

```js
{
  name: 'organic-cert',
  script: 'node_modules/.bin/next',
  args: 'start -p 3004',
  cwd: './organic-cert',
  env: {
    NODE_ENV: 'production',
    PORT: 3004,
    HOSTNAME: '0.0.0.0',
  },
  instances: 1,
  autorestart: true,
  max_restarts: 10,
  min_uptime: '10s',
  exp_backoff_restart_delay: 100,
  watch: false,
  max_memory_restart: '512M',
  listen_timeout: 30000,
  kill_timeout: 5000,
  error_file: '/var/log/farm-ops/organic-cert-error.log',
  out_file: '/var/log/farm-ops/organic-cert-out.log',
}
```

### Fix 2: deploy.sh — Add .next Pre-Flight Check

The current `deploy.sh` already builds on the server. Add a guard that verifies the build
succeeded before restarting PM2:

```bash
# After npm run build in Step 2, before Step 3 restart:
ssh $VPS 'bash -s' << 'EOF'
set -euo pipefail
if [ ! -f /srv/farm-ops/glomalin-portal/.next/BUILD_ID ]; then
  echo "ERROR: .next/BUILD_ID not found — build may have failed. Aborting restart."
  exit 1
fi
echo "  ✓ Build verified: .next/BUILD_ID present"
EOF
```

### Fix 3: sync-code.sh — Warn When Used on Next.js Apps

`sync-code.sh` is safe for Express apps (which don't need a build step). It's dangerous for
glomalin-portal if used as a fast-deploy shortcut. Add a guard:

```bash
# In sync-code.sh, after the app-specific sync for glomalin-portal:
if [ "$APP_FILTER" = "glomalin-portal" ]; then
  echo ""
  echo "  WARNING: glomalin-portal source synced, but .next was NOT deployed."
  echo "  Run 'bash scripts/deploy.sh' to build and restart the portal."
  echo "  Starting the portal without a build will crash PM2."
  echo ""
fi
```

### Fix 4: Recovery Script for Crash-Loop (One-Time Fix)

When the portal is crash-looping, this gets it back up:

```bash
#!/usr/bin/env bash
# scripts/fix-portal-crashloop.sh
# Run from LOCAL machine when portal is crash-looping
set -euo pipefail

VPS="root@165.22.6.194"

echo "Stopping crash-looping portal..."
ssh $VPS "pm2 stop glomalin-portal 2>/dev/null || true"

echo "Rebuilding on server..."
ssh $VPS 'bash -s' << 'EOF'
set -euo pipefail
cd /srv/farm-ops/glomalin-portal
npm install --prefer-offline 2>&1 | tail -1
NODE_OPTIONS='--max-old-space-size=1536' npm run build 2>&1 | tail -5
if [ ! -f .next/BUILD_ID ]; then
  echo "ERROR: Build failed — .next/BUILD_ID not found"
  exit 1
fi
echo "Build OK: $(cat .next/BUILD_ID)"
EOF

echo "Restarting from ecosystem config..."
ssh $VPS 'cd /srv/farm-ops && pm2 start ecosystem.config.js --only glomalin-portal && pm2 save'

echo "Done. Check: ssh root@165.22.6.194 \"pm2 show glomalin-portal\""
```

---

## Standalone Output Mode Assessment

### Does it Solve the Path-Patching Problem?

**Answer: Yes, but it's irrelevant to the current workflow.**

`output: 'standalone'` makes Next.js emit `.next/standalone/server.js`. That `server.js` uses
`path.join(__dirname, ...)` (relative to where server.js lives), not the absolute build-time path.
This would eliminate the client-reference-manifest absolute path issue entirely.

However, the current `deploy.sh` already builds on the server where the paths are correct
(`/srv/farm-ops/glomalin-portal/`). Switching to standalone mode would only matter if you wanted
to resume building locally and rsyncing `.next`. Since the server build works and is the correct
approach, standalone mode is a non-urgent improvement.

### What Standalone Mode Changes

| Aspect | Default Mode | Standalone Mode |
|--------|-------------|-----------------|
| Startup | `next start` | `node .next/standalone/server.js` |
| node_modules on server | Required | Bundled into `.next/standalone/node_modules/` |
| public/ dir | Served by next start | Must copy: `cp -r public .next/standalone/` |
| .next/static | Served by next start | Must copy: `cp -r .next/static .next/standalone/.next/` |
| Build machine paths | Baked in manifests | Uses `__dirname` — no path baking |
| rsync target | `.next/` | `.next/standalone/` |

### Serwist + Standalone Mode Compatibility

**Confidence: MEDIUM** (official Serwist docs do not address standalone mode; inferred from file locations)

Serwist generates `public/sw.js` and `public/swe-worker*.js` at build time. In standalone mode,
you must manually copy `public/` into `.next/standalone/public/`:

```bash
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/
```

The `swDest: "public/sw.js"` path in `next.config.mjs` is a pre-build step (Serwist wraps the
build). The generated file lands in `public/sw.js` before Next.js copies it into the standalone
bundle. As long as the copy step runs after `next build`, the service worker file will be present.

**Risk:** The `disable: process.env.NODE_ENV === 'development'` guard means `public/sw.js` will be
an empty placeholder in development. In standalone mode on the server, ensure `NODE_ENV=production`
is set before starting `server.js`.

**Recommendation:** Do not switch to standalone mode now. The server-side build workflow already
solves path problems. Standalone mode is worth evaluating when: (a) you want to build locally again,
or (b) you want to reduce server disk usage from `node_modules`. Add it as a separate improvement.

---

## The `next start` Graceful Failure Problem

**Can `next start` exit cleanly (code 1) when `.next` is missing, instead of crashing?**

Yes — `next start` exits with code 1 immediately when `.next` doesn't exist. This IS a clean exit.
The problem is that PM2 with `autorestart: true` restarts on ANY non-zero exit, including clean
"missing build" errors. There is no way to tell PM2 "stop restarting if exit code = 1 from missing
build" — `stop_exit_codes` is documented but reported as non-functional in PM2 v5+.

The correct approach is NOT trying to make PM2 smarter. The correct approach is:
1. Never start PM2 without a valid build (the `deploy.sh` pre-flight check above)
2. If PM2 is crash-looping, use `pm2 stop` + build + `pm2 start ecosystem.config.js`
3. `max_restarts: 10` with `min_uptime: '10s'` is the backstop — after 10 attempts (~100s), PM2
   stops trying and marks the process as `errored` instead of looping forever

**Important:** With `min_uptime: '10s'` — if `next start` exits at 200ms (missing `.next`), each
restart counts as "unstable". PM2 will stop after `max_restarts: 10` attempts. With
`exp_backoff_restart_delay: 100`, those 10 attempts spread out over ~30 seconds, then stop. This
is a major improvement over the 1706-restart behavior from the ad-hoc start.

---

## deploy.sh Skeleton — All 7 Steps, Atomic

```bash
#!/usr/bin/env bash
# scripts/deploy-portal.sh — Atomic portal deploy
# Builds on server, verifies .next, then restarts PM2.
# This is the ONLY sanctioned way to deploy glomalin-portal.
set -euo pipefail

VPS="root@165.22.6.194"
REMOTE_DIR="/srv/farm-ops"
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
EXCLUDE_FILE="$LOCAL_DIR/.rsyncignore"
LOCK_FILE="/tmp/farm-ops-portal-deploy.lock"

# Acquire lock (prevents concurrent deploys from separate terminals)
if [ -f "$LOCK_FILE" ]; then
  echo "ERROR: Deploy already in progress (lock: $LOCK_FILE)"
  echo "If no deploy is running, remove the lock: rm $LOCK_FILE"
  exit 1
fi
trap "rm -f $LOCK_FILE" EXIT
touch "$LOCK_FILE"

echo "═══════════════════════════════════════════════════"
echo "  Glomalin Portal — Deploy"
echo "  $(date)"
echo "═══════════════════════════════════════════════════"

# Pre-flight: ensure .rsyncignore exists
if [ ! -f "$EXCLUDE_FILE" ]; then
  echo "ERROR: .rsyncignore not found — aborting."
  exit 1
fi

echo ""
read -p "  Deploy portal to production? [y/N] " confirm
[[ "$confirm" =~ ^[Yy]$ ]] || { echo "Cancelled."; exit 0; }

# Step 1: Stop PM2 gracefully before syncing
# (prevents serving partially-updated files during sync)
echo ""
echo "[1/5] Stopping portal..."
ssh $VPS "pm2 stop glomalin-portal 2>/dev/null || true"

# Step 2: Sync source code (excludes .next, node_modules, .env, data)
echo ""
echo "[2/5] Syncing source code..."
rsync -azP --delete \
  --exclude-from="$EXCLUDE_FILE" \
  "$LOCAL_DIR/glomalin-portal/" "$VPS:$REMOTE_DIR/glomalin-portal/"
echo "  ✓ Source synced"

# Step 3: Install deps + build on server
# Server build avoids path-patching: manifests bake /srv/farm-ops/glomalin-portal/ paths
echo ""
echo "[3/5] Building on server (this takes ~90s)..."
ssh $VPS 'bash -s' << 'REMOTE_BUILD'
set -euo pipefail
cd /srv/farm-ops/glomalin-portal

echo "  → npm install..."
npm install --prefer-offline 2>&1 | tail -1

echo "  → npm run build..."
NODE_OPTIONS='--max-old-space-size=1536' npm run build 2>&1

echo "  ✓ Build complete"
REMOTE_BUILD

# Step 4: Verify .next exists and looks valid
echo ""
echo "[4/5] Verifying build..."
ssh $VPS 'bash -s' << 'VERIFY'
set -euo pipefail
BUILD_ID_FILE="/srv/farm-ops/glomalin-portal/.next/BUILD_ID"
if [ ! -f "$BUILD_ID_FILE" ]; then
  echo "ERROR: .next/BUILD_ID not found — build failed or incomplete"
  exit 1
fi
BUILD_ID=$(cat "$BUILD_ID_FILE")
echo "  ✓ Build verified: $BUILD_ID"
VERIFY

# Step 5: Start from ecosystem config
echo ""
echo "[5/5] Starting portal from ecosystem config..."
ssh $VPS 'bash -s' << 'RESTART'
set -euo pipefail
cd /srv/farm-ops

# Always start from ecosystem.config.js — never ad-hoc
pm2 start ecosystem.config.js --only glomalin-portal
pm2 save

# Wait briefly and check status
sleep 5
STATUS=$(pm2 show glomalin-portal | grep "status" | head -1)
echo "  $STATUS"

# Verify not crash-looping
RESTARTS=$(pm2 show glomalin-portal | grep "restarts" | head -1)
echo "  $RESTARTS"
RESTART

echo ""
echo "═══════════════════════════════════════════════════"
echo "  DEPLOY COMPLETE"
echo "  https://portal.whughesfarms.com"
echo "  $(date)"
echo "═══════════════════════════════════════════════════"
```

**Notes on the skeleton:**
- Lock file prevents two concurrent portal deploys from interfering
- `pm2 stop` before rsync prevents "partially updated" state
- `--prefer-offline` speeds up npm install on server (dependencies already present)
- Build on server eliminates path-patching entirely
- `.next/BUILD_ID` verification catches failed builds before restart
- `pm2 start ecosystem.config.js --only glomalin-portal` is idempotent — safe if process exists

---

## Why organic-cert Gets the Same Treatment

organic-cert is Next.js 16 (newer than glomalin-portal at 14.2.35). It faces the same failure class:
- No build → `next start` exits immediately
- PM2 ad-hoc start → crash-loop
- `ecosystem.config.js` already has it configured correctly

Apply the same ecosystem.config.js changes (`min_uptime`, `exp_backoff_restart_delay`,
`listen_timeout`, log paths). Build workflow is already server-side in `deploy.sh` and `deploy-vps.sh`.

**organic-cert does NOT need Serwist consideration** — it uses next-auth + Prisma, no PWA.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Crash-loop prevention | Custom exit code monitor | `max_restarts` + `min_uptime` in ecosystem.config.js |
| Concurrent deploy prevention | Complex locking system | Simple `LOCK_FILE` + `trap EXIT` |
| Build verification | Parse npm output | Check `.next/BUILD_ID` file existence |
| Graceful process stop | SIGKILL scripts | `pm2 stop` (sends SIGINT, waits, then SIGKILL) |

---

## Common Pitfalls

### Pitfall 1: Ad-Hoc PM2 Start Bypasses ecosystem.config.js

**What goes wrong:** `pm2 start npm --name glomalin-portal -- start` creates a process with
PM2's default settings (autorestart=true, no max_restarts limit, no restart_delay). The
ecosystem.config.js is ignored entirely.

**How to detect:** `pm2 show glomalin-portal | grep "exec interpreter"` — if it shows `/usr/bin/npm`
instead of `node`, the process was started ad-hoc.

**How to avoid:** Always use `pm2 start ecosystem.config.js --only glomalin-portal`. If the process
already exists from an ad-hoc start, delete it first: `pm2 delete glomalin-portal && pm2 start
ecosystem.config.js --only glomalin-portal`.

### Pitfall 2: sync-code.sh Used as Portal "Fast Deploy"

**What goes wrong:** Developer pushes a code fix with `sync-code.sh glomalin-portal` (syncs source,
leaves `.next` unchanged). Then restarts PM2 expecting new code to be live. The restart works if
`.next` exists, but now `.next` and `src/` are out of sync — serving stale builds with new routes
missing.

**How to avoid:** glomalin-portal deploys always go through `deploy-portal.sh` or `deploy.sh`,
which includes the build step. `sync-code.sh` is only safe for Express apps.

### Pitfall 3: max_memory_restart=512M on a 1GB Droplet with Two Next.js Apps

**What goes wrong:** Both glomalin-portal and organic-cert are configured to restart at 512M.
Node.js RSS for Next.js in production is typically 150-300MB. But Next.js build (done server-side)
spikes to 1.2-1.5GB, hitting the 1536M cap set in `NODE_OPTIONS`. If both apps are running during
a build, available RAM is `1024 - ~300M (portal) - ~300M (cert) = ~400M` before any OOM
intervention. The `--max-old-space-size=1536` flag is the correct cap for builds (slightly over
physical RAM, relies on swap), but do not run both builds concurrently.

**How to avoid:** Build apps sequentially (existing scripts already do this). Ensure swap is
enabled on the droplet (`swapon -s` — if empty, add 2GB swap file).

### Pitfall 4: pm2 save Not Called After ecosystem.config.js Change

**What goes wrong:** ecosystem.config.js is updated locally and rsynced to the server. Next reboot,
PM2 restores from the saved dump (which reflects the old ad-hoc process structure), not from
ecosystem.config.js. Crash-loop returns after any server reboot.

**How to avoid:** After any PM2 process structure change: `pm2 start ecosystem.config.js && pm2 save`.
The `pm2 save` overwrites the dump file with the current process list.

---

## Validation

To confirm the fix is working after applying:

```bash
# On VPS
pm2 show glomalin-portal

# Look for:
#   status         | online          ← not errored, not stopped
#   restarts       | 0               ← no crash-loops
#   uptime         | Xm Xs           ← running
#   exec interpreter| node           ← ecosystem.config.js (not ad-hoc npm)
#   script         | node_modules/.bin/next  ← correct path
```

Verify build artifacts exist:
```bash
ssh root@165.22.6.194 "cat /srv/farm-ops/glomalin-portal/.next/BUILD_ID"
# Should return a hash like: cffe535...
```

---

## Sources

### Primary (HIGH confidence)
- Direct file inspection: `ecosystem.config.js`, `scripts/deploy.sh`, `scripts/sync-code.sh`,
  `.rsyncignore` — all read from local repo
- Direct file inspection: `.next/server/app/page_client-reference-manifest.js` — confirms current
  build bakes `/srv/farm-ops/glomalin-portal/` paths (server-built, path-patching not needed)
- [Next.js output docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) —
  standalone mode behavior, server.js usage, public dir copy requirement
- [PM2 Ecosystem File docs](https://pm2.keymetrics.io/docs/usage/application-declaration/) —
  max_restarts, min_uptime, restart_delay, exp_backoff_restart_delay syntax

### Secondary (MEDIUM confidence)
- [PM2 Restart Strategies docs](https://pm2.keymetrics.io/docs/usage/restart-strategies/) —
  exp_backoff_restart_delay: 100 syntax confirmed
- [Grizzly Peak: Stop PM2 Crash Loops](https://www.grizzlypeaksoftware.com/articles/p/stop-pm2-crash-loops-the-unstable-restarts-fix-that-actually-works-6lvxhqim) —
  min_uptime: '10s' + max_restarts: 10 recommended values
- [Serwist Next.js docs](https://serwist.pages.dev/docs/next/getting-started) — swDest: "public/sw.js"
  confirmed; standalone mode not mentioned (absence noted)

### Tertiary (LOW confidence)
- `stop_exit_codes` non-functional in PM2 v5+ — multiple GitHub issues corroborate but no official
  PM2 statement; flag for testing before relying on it
