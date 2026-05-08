#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# deploy-vps.sh — One-shot VPS setup for Farm Operations Platform
# Run from your LOCAL machine (not the VPS).
#
# Usage:
#   bash scripts/deploy-vps.sh
#
# Prerequisites:
#   - DigitalOcean droplet running Ubuntu 22.04 at 165.22.6.194
#   - DNS A records pointing *.whughesfarms.com to 165.22.6.194
#   - Root password for the droplet
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

VPS_IP="165.22.6.194"
VPS_USER="root"
REMOTE_DIR="/srv/farm-ops"
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "═══════════════════════════════════════════════════"
echo "  Farm Ops Platform — VPS Deployment"
echo "  Target: ${VPS_USER}@${VPS_IP}"
echo "═══════════════════════════════════════════════════"
echo ""

# ── Step 1: System setup on VPS ──────────────────────────────────
echo "[1/6] Setting up VPS (Node.js, PM2, Caddy, PostgreSQL)..."
ssh ${VPS_USER}@${VPS_IP} 'bash -s' << 'REMOTE_SETUP'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

echo "  → Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq

echo "  → Installing Node.js 20 LTS..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi
echo "  Node.js $(node --version)"

echo "  → Installing PM2..."
npm install -g pm2 2>/dev/null || true
echo "  PM2 $(pm2 --version)"

echo "  → Installing Caddy..."
if ! command -v caddy &>/dev/null; then
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>/dev/null
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -qq
  apt-get install -y -qq caddy
fi
echo "  Caddy $(caddy version)"

echo "  → Installing PostgreSQL..."
if ! command -v psql &>/dev/null; then
  apt-get install -y -qq postgresql postgresql-contrib
  systemctl enable postgresql
  systemctl start postgresql
fi
echo "  PostgreSQL $(psql --version | head -1)"

echo "  → Creating app directory..."
mkdir -p /srv/farm-ops

echo "  ✓ VPS system setup complete"
REMOTE_SETUP

# ── Step 2: Upload project files ─────────────────────────────────
echo ""
echo "[2/6] Uploading project files to VPS..."

# Use rsync to upload, excluding data files, node_modules, .env, etc.
# Exclusions are centralized in .rsyncignore to prevent accidental data loss.
rsync -azP --delete \
  --exclude-from="${LOCAL_DIR}/.rsyncignore" \
  "${LOCAL_DIR}/" "${VPS_USER}@${VPS_IP}:${REMOTE_DIR}/"

echo "  ✓ Files uploaded"

# ── Step 3: Install dependencies ─────────────────────────────────
echo ""
echo "[3/6] Installing dependencies on VPS..."
ssh ${VPS_USER}@${VPS_IP} 'bash -s' << 'REMOTE_INSTALL'
set -euo pipefail
cd /srv/farm-ops

APPS="glomalin-portal grain-tickets farm-budget fsa-acres meristem-malt farm-registry seed-inventory organic-cert"

for app in $APPS; do
  if [ -d "$app" ] && [ -f "$app/package.json" ]; then
    echo "  → npm install: $app"
    cd "$app"
    npm install --production 2>&1 | tail -1
    cd /srv/farm-ops
  fi
done

echo "  ✓ Dependencies installed"
REMOTE_INSTALL

# ── Step 4: Build Next.js apps ───────────────────────────────────
echo ""
echo "[4/6] Building Next.js apps..."
ssh ${VPS_USER}@${VPS_IP} 'bash -s' << 'REMOTE_BUILD'
set -euo pipefail
cd /srv/farm-ops

echo "  → Building glomalin-portal..."
cd glomalin-portal && NODE_OPTIONS='--max-old-space-size=1536' npm run build 2>&1 | tail -3
cd /srv/farm-ops

echo "  → Building organic-cert..."
cd organic-cert && npm run build 2>&1 | tail -3
cd /srv/farm-ops

echo "  ✓ Builds complete"
REMOTE_BUILD

# ── Step 5: Set up PostgreSQL databases ──────────────────────────
echo ""
echo "[5/6] Setting up PostgreSQL databases..."
ssh ${VPS_USER}@${VPS_IP} 'bash -s' << 'REMOTE_DB'
set -euo pipefail

# Generate a random password for the farmops DB user
DB_PASS=$(openssl rand -base64 24)

# Create user and databases (idempotent)
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='farmops'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER farmops WITH PASSWORD '${DB_PASS}';"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='grain_tickets'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE grain_tickets OWNER farmops;"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='organic_cert'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE organic_cert OWNER farmops;"

# Update .env files with the real DATABASE_URL
cd /srv/farm-ops

# grain-tickets
sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"postgresql://farmops:${DB_PASS}@localhost:5432/grain_tickets?schema=public\"|" grain-tickets/.env

# organic-cert (if it has a .env)
if [ -f organic-cert/.env ]; then
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"postgresql://farmops:${DB_PASS}@localhost:5432/organic_cert\"|" organic-cert/.env
fi

# Run Prisma migrations
echo "  → Running grain-tickets Prisma migration..."
cd /srv/farm-ops/grain-tickets && npx prisma db push 2>&1 | tail -2

if [ -f /srv/farm-ops/organic-cert/prisma/schema.prisma ]; then
  echo "  → Running organic-cert Prisma migration..."
  cd /srv/farm-ops/organic-cert && npx prisma db push 2>&1 | tail -2
fi

echo "  ✓ Databases ready (user: farmops, pass saved in .env files)"
REMOTE_DB

# ── Step 6: Start everything ─────────────────────────────────────
echo ""
echo "[6/6] Starting apps with PM2 and configuring Caddy..."
ssh ${VPS_USER}@${VPS_IP} 'bash -s' << 'REMOTE_START'
set -euo pipefail
cd /srv/farm-ops

echo "  → Starting PM2 apps..."
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root 2>&1 | tail -1

echo "  → Configuring Caddy..."
cp /srv/farm-ops/Caddyfile /etc/caddy/Caddyfile

# Set domain via systemd override
mkdir -p /etc/systemd/system/caddy.service.d
cat > /etc/systemd/system/caddy.service.d/override.conf << EOF
[Service]
Environment=DOMAIN=whughesfarms.com
EOF

systemctl daemon-reload
systemctl restart caddy
systemctl enable caddy

echo ""
echo "  → Checking app status..."
pm2 status

echo ""
echo "  ✓ All services started!"
echo ""
echo "═══════════════════════════════════════════════════"
echo "  DEPLOYMENT COMPLETE"
echo ""
echo "  Portal:    https://portal.whughesfarms.com"
echo "  Budget:    https://budget.whughesfarms.com"
echo "  FSA:       https://fsa.whughesfarms.com"
echo "  Malt:      https://malt.whughesfarms.com"
echo "  Cert:      https://cert.whughesfarms.com"
echo "  Registry:  https://registry.whughesfarms.com"
echo "  Seed:      https://seed.whughesfarms.com"
echo "  Tickets:   https://tickets.whughesfarms.com"
echo ""
echo "  Caddy will auto-provision HTTPS certificates."
echo "  Allow 1-2 minutes for Let's Encrypt to issue them."
echo "═══════════════════════════════════════════════════"
REMOTE_START
