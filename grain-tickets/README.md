# Grain Tickets

Scale-ticket entry and reconciliation for W. Hughes Farms. Express + Prisma
(PostgreSQL), served on `PORT` (default `3007`) and reached through the portal
rather than a direct subdomain.

Deliveries recorded here are pushed to the marketing module (organic-cert, port
`3004`) so bushels accumulate against grain contracts.

## Environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string. |
| `PORT` | HTTP port. Defaults to `3007`. |
| `EMBED_TOKEN` | **Inbound.** Gates this app's API. |
| `ECOSYSTEM_TOKEN` | **Outbound.** Authenticates *our* calls to organic-cert's marketing API. |
| `CERT_SERVICE_URL` | organic-cert base URL. Defaults to `http://localhost:3004`. |
| `REGISTRY_TOKEN`, `FARM_REGISTRY_URL`, `FARM_BUDGET_URL`, `BUDGET_API_URL`, `PORTAL_API_URL`, `PORTAL_ORIGIN` | Sibling service wiring. |
| `ANTHROPIC_API_KEY`, `CHAT_AGENT_ENABLED`, `CHAT_DAILY_CAP` | Chat agent. |

### The two tokens are different secrets

They are independent, rotate on different schedules, and are not
interchangeable. Do not consolidate them.

**`EMBED_TOKEN` — inbound, who may call us.** Browsers never see it. They
authenticate with a per-user grant minted by the portal
(`v1.<app>.<userId>.<exp>.<hmacHex>`), HMAC-signed with this server-held value.
The raw token is accepted only from server-to-server callers, via `?token=` or
the `x-embed-token` header.

**`ECOSYSTEM_TOKEN` — outbound, how organic-cert recognises us.** Sent as
`x-ecosystem-token` when pushing deliveries (`pushDeliveryToMarketing`) and when
fetching buyers (`fetchMarketingCustomers`).

> **`ECOSYSTEM_TOKEN` must equal organic-cert's `ECOSYSTEM_TOKEN` on the same
> host.** Two hosts may hold different values, but within one host they must
> match, or every marketing push returns 403.

Verify parity without ever printing a value — compare digests:

```bash
gt=$(grep "^ECOSYSTEM_TOKEN=" grain-tickets/.env | cut -d= -f2- | tr -d '"' | sha256sum | cut -c1-8)
oc=$(grep "^ECOSYSTEM_TOKEN=" organic-cert/.env  | cut -d= -f2- | tr -d '"' | sha256sum | cut -c1-8)
[ -n "$gt" ] && [ "$gt" = "$oc" ] && echo TOKEN-PARITY-OK || echo MISMATCH-OR-MISSING
```

Never echo, log, paste, or commit a token value — not into a terminal, a commit
message, or a planning document.

#### The fallback, and why it stays

`server.js` reads `ECOSYSTEM_TOKEN || EMBED_TOKEN`. That fallback is
deliberate, but it is also what caused the **2026-08-06 outage**: with no
`ECOSYSTEM_TOKEN` set, the app quietly fell back to `EMBED_TOKEN`, organic-cert
rejected it with 403, and deliveries stopped reaching marketing **silently** —
nothing surfaced in the UI, and tickets accumulated unsynced for days.

Since Phase 17 the failure is no longer silent: every push outcome is persisted
to the ticket's `marketingSync*` columns and rendered as a **Marketing Sync**
pill in the ticket table, so a fallback-only host now shows `Sync failed` rather
than nothing. The fallback is kept so a misconfigured host degrades visibly
instead of refusing to boot.

#### After changing a token

PM2 does not reload `.env` on a plain restart:

```bash
pm2 restart grain-tickets --update-env
```

A plain `pm2 restart` reuses the old environment and the change appears to have
no effect.

## Recovery: re-pushing deliveries

`scripts/repush-deliveries.cjs` is the recovery tool after any token outage,
marketing downtime, or crop-variant gap:

```bash
cd /srv/farm-ops/grain-tickets && node scripts/repush-deliveries.cjs
```

It re-pushes every buyer-bound ticket. **It is idempotent** — the ingest
endpoint upserts on a `[grain-ticket:<id>]` marker, so existing deliveries
update, missing ones are created, and manual contract applications are
preserved. It writes the same `marketingSync*` status columns the live push
writes, so historical tickets get a real status rather than staying blank.

Use it when:

- `ECOSYSTEM_TOKEN` was missing or wrong and pushes were 403ing
- organic-cert was down or mid-deploy while tickets were saved
- a crop had no `GrainVariant` at save time and the push was skipped — fix the
  variant first, then re-push

Its payload mirrors `pushDeliveryToMarketing` in `server.js`, and its
persistence goes through `lib/marketing-sync.js`. **Keep all three in sync** —
if you change the push payload or the status rules in one, change it in the
others.

## Marketing sync status

`lib/marketing-sync.js` is the single source of truth for turning a push
outcome into a persisted status. Six states reach the UI:

| Status | Meaning |
|---|---|
| `applied` | Delivery counted against a named contract. |
| `unapplied` | Synced, but no matching open contract. |
| `skipped` | Crop has no marketing variant — delivery does not count. |
| `error` | Push failed (403, network, server error). |
| `no-buyer` | Ticket has no buyer; nothing to sync. Derived at read time. |
| `pending` | Not yet attempted. Derived at read time. |

`no-buyer` and `pending` are **derived on read and never persisted**. Only the
first four are written to the database.

Status is exposed on every ticket payload as `_marketingSync`, alongside
`_reconciliation`.

## Development

```bash
npm install
npx prisma migrate deploy   # NOT migrate dev — see below
npx prisma generate
npm start
npm test                    # node --test
```

### Migrations: use `migrate deploy`

The database carries columns applied by an earlier `prisma db push` that no
migration declares — `Ticket.registryCropId`, `Ticket.splitGroupId`,
`Ticket.testWeight`, and the `MarketingPushSkip` table. **Production and local
share this drift**, so the two agree with each other.

`prisma migrate dev` detects that drift, refuses to run, and offers only
`migrate reset` — which would **drop those columns** and leave local diverging
from production. Do not run it.

To add columns, generate the migration from the live database instead:

```bash
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/<timestamp>_<name>/migration.sql
```

Because the database already holds the drift, the output contains only your
genuinely new columns. **Inspect it before applying** — any reference to the
drift columns above means the database is not in the expected state. Apply with
`npx prisma migrate deploy`.

### Front-end assets are cache-busted by hand

`public/*.js` and `public/*.css` are served with a `?v=` query string in
`public/index.html`. **Bump it whenever you edit one** — cache headers alone
have failed in production before, and splitting an asset edit from its version
bump across two commits is what caused a stale-asset incident on 2026-08-05.
Commit the asset and the bump together.

### A trap in this directory

`grain-tickets/.git` is a **dead nested repository** holding a single commit
from Feb 2026. The real repository is the parent, `my-project-one`. Any git
command run with the working directory *inside* `grain-tickets/` silently
targets the dead repo and reports a large, entirely fictional diff.

Always run git from the parent with a `grain-tickets/`-prefixed path:

```bash
cd ~/Desktop/my-project-one
git status --short -- grain-tickets/
```
