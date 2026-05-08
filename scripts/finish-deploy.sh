#!/usr/bin/env bash
# Finish the remaining deploy steps (portal already built)
set -euo pipefail

VPS="root@165.22.6.194"

echo "═══ Finishing VPS Deploy ═══"
echo ""

ssh $VPS 'bash -s' << 'EOF'
set -euo pipefail
cd /srv/farm-ops

# 1. Build organic-cert
echo "[1/4] Building organic-cert..."
cd organic-cert && npm install 2>&1 | tail -1
npm run build 2>&1 | tail -3
cd /srv/farm-ops
echo "  ✓ organic-cert built"

# 2. Set up PostgreSQL
echo ""
echo "[2/4] Setting up PostgreSQL..."
DB_PASS=$(openssl rand -base64 24)

sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='farmops'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER farmops WITH PASSWORD '${DB_PASS}';"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='grain_tickets'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE grain_tickets OWNER farmops;"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='organic_cert'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE organic_cert OWNER farmops;"

# Update DATABASE_URL in .env files
sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"postgresql://farmops:${DB_PASS}@localhost:5432/grain_tickets?schema=public\"|" grain-tickets/.env

if [ -f organic-cert/.env ]; then
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"postgresql://farmops:${DB_PASS}@localhost:5432/organic_cert\"|" organic-cert/.env
else
  echo "DATABASE_URL=\"postgresql://farmops:${DB_PASS}@localhost:5432/organic_cert\"" > organic-cert/.env
fi

# Run Prisma migrations
echo "  → Prisma push: grain-tickets"
cd /srv/farm-ops/grain-tickets && npx prisma db push --accept-data-loss 2>&1 | tail -2

if [ -f /srv/farm-ops/organic-cert/prisma/schema.prisma ]; then
  echo "  → Prisma push: organic-cert"
  cd /srv/farm-ops/organic-cert && npx prisma db push --accept-data-loss 2>&1 | tail -2
fi
echo "  ✓ Databases ready"

# 3. Start PM2
echo ""
echo "[3/4] Starting PM2 apps..."
cd /srv/farm-ops
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root 2>&1 | tail -1
echo "  ✓ PM2 running"

# 4. Configure Caddy
echo ""
echo "[4/4] Configuring Caddy..."
cp /srv/farm-ops/Caddyfile /etc/caddy/Caddyfile

mkdir -p /etc/systemd/system/caddy.service.d
cat > /etc/systemd/system/caddy.service.d/override.conf << CADDY
[Service]
Environment=DOMAIN=whughesfarms.com
CADDY

systemctl daemon-reload
systemctl restart caddy
systemctl enable caddy
echo "  ✓ Caddy configured"

echo ""
pm2 status
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
echo "  HTTPS certificates will auto-provision in 1-2 min."
echo "═══════════════════════════════════════════════════"
EOF
