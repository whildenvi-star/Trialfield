# Production Secrets Reference

**Location on VPS:** /root/SECRETS.md (chmod 600)
**DO NOT commit this file with real values to git.**

Copy this template to VPS and fill in real values:

```bash
cp scripts/SECRETS.template.md /root/SECRETS.md
chmod 600 /root/SECRETS.md
```

---

## Supabase (glomalin-portal)

| Secret | Value | Used By | Env File | Rotation |
|--------|-------|---------|----------|----------|
| NEXT_PUBLIC_SUPABASE_URL | `https://xxx.supabase.co` | glomalin-portal | glomalin-portal/.env | Supabase Dashboard > Settings > API |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | `eyJ...` | glomalin-portal | glomalin-portal/.env | Supabase Dashboard > Settings > API > Regenerate |
| SUPABASE_SERVICE_ROLE_KEY | `eyJ...` | glomalin-portal (server) | glomalin-portal/.env | Supabase Dashboard > Settings > API > Regenerate |
| SUPABASE_DB_URL | `postgresql://postgres:xxx@db.xxx.supabase.co:5432/postgres` | backup.sh, glomalin-portal | glomalin-portal/.env | Supabase Dashboard > Settings > Database > Connection string |

## PostgreSQL (local)

| Secret | Value | Used By | Env File | Rotation |
|--------|-------|---------|----------|----------|
| DATABASE_URL (grain-tickets) | `postgresql://farmops:xxx@localhost:5432/grain_tickets` | grain-tickets | grain-tickets/.env | `ALTER USER farmops PASSWORD 'newpass';` then update .env |
| DATABASE_URL (organic-cert) | `postgresql://farmops:xxx@localhost:5432/organic_cert` | organic-cert | organic-cert/.env | Same ALTER USER + .env update |

## Case IH / CNH Industrial

| Secret | Value | Used By | Env File | Rotation |
|--------|-------|---------|----------|----------|
| CNH_CLIENT_ID | `xxx` | farm-budget (FieldOps sync) | farm-budget/.env | CNH Developer Portal |
| CNH_CLIENT_SECRET | `xxx` | farm-budget (FieldOps sync) | farm-budget/.env | CNH Developer Portal |

## Application Secrets

| Secret | Value | Used By | Env File | Rotation |
|--------|-------|---------|----------|----------|
| PORTAL_ORIGIN | `https://portal.yourdomain.com` | All 6 Express apps (CORS) | each app's .env | Update all .env files + pm2 restart |

---

## Rotation Checklist

1. Change the secret at its source (Supabase Dashboard, psql, CNH Developer Portal, etc.)
2. Update the .env file(s) listed above
3. Restart affected app(s): `pm2 restart <app-name>`
4. Verify the app works (check PM2 logs: `pm2 logs <app-name>`)
5. Update the value in this file
