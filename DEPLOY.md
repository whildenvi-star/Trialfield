# Farm Operations Platform — VPS Deployment Guide

Step-by-step instructions to set up the entire platform on a fresh VPS from scratch.

> ⚠️ **NEVER hand-type `rsync` or `scp` to the VPS. Always deploy with `scripts/deploy-vps.sh`.**
> The deploy script applies `.rsyncignore`, which protects every app's `data/data.json` from
> being overwritten by stale local copies. A manual rsync on 2026-06-27 bypassed it and
> destroyed 566 orders and 508 receipts of production seed-inventory data (unrecoverable —
> the droplet's 7-day backup retention had already purged the last good copy).
> Also: connection strings for the shared local PostgreSQL must use `127.0.0.1`, not
> `localhost` — `localhost` resolves to `::1`, which pg_hba does not trust, and dual-writes
> fail silently.

---

## 1. Prerequisites

- Ubuntu 22.04+ VPS with root or sudo access (recommend 2 GB+ RAM for 8 apps)
- A registered domain name (e.g., `yourfarm.com`)
- DNS provider access (for creating A records)
- SSH access to the VPS

## 2. DNS Configuration

Create A records pointing to the VPS public IP address. You need one record for each app subdomain:

| Record            | Type | Value          |
|-------------------|------|----------------|
| `yourdomain.com`         | A    | `<VPS_IP>` |
| `portal.yourdomain.com`  | A    | `<VPS_IP>` |
| `budget.yourdomain.com`  | A    | `<VPS_IP>` |
| `fsa.yourdomain.com`     | A    | `<VPS_IP>` |
| `malt.yourdomain.com`    | A    | `<VPS_IP>` |
| `cert.yourdomain.com`    | A    | `<VPS_IP>` |
| `registry.yourdomain.com`| A    | `<VPS_IP>` |
| `seed.yourdomain.com`    | A    | `<VPS_IP>` |
| `tickets.yourdomain.com` | A    | `<VPS_IP>` |

Alternatively, use a wildcard record instead of 9 individual records:

```
*.yourdomain.com  A  <VPS_IP>
yourdomain.com    A  <VPS_IP>
```

DNS must propagate before Caddy can issue TLS certificates. Verify with:

```bash
dig portal.yourdomain.com +short
```

It should return your VPS IP address.

## 3. System Setup

Update system packages and install dependencies:

```bash
sudo apt update && sudo apt upgrade -y
```

Install Node.js 20 LTS via NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # should print v20.x
```

Install PM2 globally:

```bash
sudo npm install -g pm2
```

Install PostgreSQL 15+ (needed for grain-tickets and organic-cert databases):

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

## 4. Install Caddy

Add the Caddy official apt repository and install:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

Caddy runs as a systemd service and handles auto-HTTPS (Let's Encrypt certificates) with zero configuration.

## 5. Clone and Install

Clone the repository:

```bash
git clone <repo-url> /srv/farm-ops
cd /srv/farm-ops
```

Install dependencies for each app:

```bash
cd /srv/farm-ops/grain-tickets && npm install
cd /srv/farm-ops/farm-budget && npm install
cd /srv/farm-ops/fsa-acres && npm install
cd /srv/farm-ops/meristem-malt && npm install
cd /srv/farm-ops/farm-registry && npm install
cd /srv/farm-ops/seed-inventory && npm install
cd /srv/farm-ops/glomalin-portal && npm install
cd /srv/farm-ops/organic-cert && npm install
```

Build the two Next.js apps:

```bash
cd /srv/farm-ops/glomalin-portal && npm run build
cd /srv/farm-ops/organic-cert && npm run build
```

**Note:** `organic-cert` has its own `.git` directory. If using a monorepo clone, it should already be included. If it's a separate submodule, clone it into `/srv/farm-ops/organic-cert` separately.

## 6. Environment Configuration

Each app has a `.env.example` template. Copy and fill in real values:

```bash
cd /srv/farm-ops
for app in grain-tickets farm-budget fsa-acres meristem-malt farm-registry seed-inventory glomalin-portal organic-cert; do
  cp "$app/.env.example" "$app/.env"
done
```

Edit each `.env` file with production values. The critical variables that **must** be set:

### glomalin-portal/.env

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_SITE_URL=https://portal.yourdomain.com
```

### All Express apps (grain-tickets, farm-budget, fsa-acres, meristem-malt, farm-registry, seed-inventory)

```
PORTAL_ORIGIN=https://portal.yourdomain.com
```

This controls the CORS allowlist so the portal can embed each app.

### grain-tickets/.env and organic-cert/.env

```
DATABASE_URL="postgresql://farmops:YOUR_PASSWORD@localhost:5432/grain_tickets?schema=public"
```

```
DATABASE_URL="postgresql://farmops:YOUR_PASSWORD@localhost:5432/organic_cert"
```

### organic-cert/.env

```
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
NEXTAUTH_URL=https://cert.yourdomain.com
```

See each app's `.env.example` for the full list of available variables.

## 7. PostgreSQL Setup

Create a database user and the two required databases:

```bash
sudo -u postgres psql
```

```sql
CREATE USER farmops WITH PASSWORD 'YOUR_SECURE_PASSWORD';
CREATE DATABASE grain_tickets OWNER farmops;
CREATE DATABASE organic_cert OWNER farmops;
\q
```

Run Prisma migrations to set up the schema:

```bash
cd /srv/farm-ops/grain-tickets && npx prisma db push
cd /srv/farm-ops/organic-cert && npx prisma db push
```

## 8. Start Apps with PM2

Start all 8 apps using the ecosystem config:

```bash
cd /srv/farm-ops
pm2 start ecosystem.config.js
```

Save the process list so PM2 remembers it after reboot:

```bash
pm2 save
```

Generate the systemd startup script so PM2 auto-starts on boot:

```bash
pm2 startup
```

Follow the command it outputs (it will print a `sudo` command to run).

Verify all apps are running:

```bash
pm2 status
```

All 8 apps should show status "online". See `ecosystem.config.js` for the full configuration (ports, memory limits, restart policies).

## 9. Configure Caddy

Copy the Caddyfile to the Caddy config directory:

```bash
sudo cp /srv/farm-ops/Caddyfile /etc/caddy/Caddyfile
```

Set your domain via a systemd environment override:

```bash
sudo systemctl edit caddy
```

In the editor, add:

```ini
[Service]
Environment=DOMAIN=yourdomain.com
```

Save and reload Caddy:

```bash
sudo systemctl reload caddy
```

Caddy will automatically obtain Let's Encrypt TLS certificates for all configured subdomains. This requires DNS A records to already be pointing to the VPS IP (see Section 2).

Verify it works:

```bash
curl -I https://portal.yourdomain.com
```

Should return HTTP 200. If certificates are still being provisioned, wait a minute and retry.

## 10. Updating (Deploy Workflow)

To deploy new changes:

```bash
ssh user@your-vps-ip
cd /srv/farm-ops
git pull origin main
```

Install dependencies for any apps that changed:

```bash
cd /srv/farm-ops/<changed-app> && npm install
```

For Next.js apps (glomalin-portal, organic-cert), rebuild after changes:

```bash
cd /srv/farm-ops/glomalin-portal && npm run build
cd /srv/farm-ops/organic-cert && npm run build
```

Restart all apps:

```bash
cd /srv/farm-ops
pm2 restart ecosystem.config.js
pm2 save
```

## 11. Port Map Reference

| App             | Port | Subdomain   | Technology  |
|-----------------|------|-------------|-------------|
| glomalin-portal | 3000 | portal.*    | Next.js 14  |
| farm-budget     | 3001 | budget.*    | Express     |
| fsa-acres       | 3002 | fsa.*       | Express     |
| meristem-malt   | 3003 | malt.*      | Express     |
| organic-cert    | 3004 | cert.*      | Next.js 16  |
| farm-registry   | 3005 | registry.*  | Express     |
| seed-inventory  | 3006 | seed.*      | Express     |
| grain-tickets   | 3007 | tickets.*   | Express     |

This matches the configuration in `ecosystem.config.js` and the `Caddyfile`.

## 12. Troubleshooting

**Check app logs:**

```bash
pm2 logs <app-name>
pm2 logs grain-tickets --lines 50
```

**Check Caddy logs:**

```bash
sudo journalctl -u caddy
sudo journalctl -u caddy --since "5 minutes ago"
```

**Validate Caddy config syntax:**

```bash
caddy validate --config /etc/caddy/Caddyfile
```

**If TLS certificate fails:**

Verify DNS is propagated:

```bash
dig portal.yourdomain.com +short
```

If it does not return your VPS IP, DNS has not propagated yet. Wait and retry.

**If app returns 502 Bad Gateway:**

The app may have crashed. Check its status:

```bash
pm2 status
```

If an app shows "errored" or "stopped", check its logs and restart:

```bash
pm2 logs <app-name> --lines 100
pm2 restart <app-name>
```

**If PM2 apps do not survive reboot:**

Re-run the startup setup:

```bash
pm2 save
pm2 startup
```

**If PostgreSQL connection fails:**

Verify PostgreSQL is running and the connection string in `.env` is correct:

```bash
sudo systemctl status postgresql
sudo -u postgres psql -c "SELECT 1;"
```
