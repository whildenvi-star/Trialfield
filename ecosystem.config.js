/**
 * PM2 Ecosystem Configuration
 * Farm Operations Platform — All 8 apps
 *
 * Port Map:
 *   3000  glomalin-portal   (Next.js 14 — main portal)
 *   3001  farm-budget        (Express — budget planning)
 *   3002  fsa-acres          (Express — FSA acreage)
 *   3003  meristem-malt      (Express — malt budgets)
 *   3004  organic-cert       (Next.js 16 — USDA NOP audit)
 *   3005  farm-registry      (Express — field registry)
 *   3006  seed-inventory     (Express — seed tracking)
 *   3007  grain-tickets      (Express — grain traceability)
 *
 * Domain: farm.example.com (placeholder — update when DNS configured)
 *
 * Deploy Workflow:
 *   1. ssh into VPS
 *   2. cd /srv/farm-ops (or wherever repo lives)
 *   3. git pull origin main
 *   4. For each app with changes: cd <app> && npm install && cd ..
 *   5. For Next.js apps: cd <app> && npm run build && cd ..
 *   6. pm2 restart ecosystem.config.js
 *   7. pm2 save
 */

module.exports = {
  apps: [
    // ── Next.js Apps ──────────────────────────────────────────

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
      max_restarts: 10,
      min_uptime: '10s',
      exp_backoff_restart_delay: 100,
      listen_timeout: 30000,
      kill_timeout: 5000,
      watch: false,
      max_memory_restart: '512M',
    },

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
      listen_timeout: 30000,
      kill_timeout: 5000,
      watch: false,
      max_memory_restart: '512M',
    },

    // ── Express Apps ──────────────────────────────────────────

    {
      name: 'farm-budget',
      script: 'server.js',
      cwd: './farm-budget',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        // EMBED_TOKEN comes from farm-budget/.env (droplet-only, never committed)
      },
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      watch: false,
      max_memory_restart: '256M',
    },

    {
      // MACRO 2027 — the NEXT-year plan, running in parallel so 2027 planning
      // can happen while 2026 keeps tracking. Same codebase, own data file
      // (data/data-2027.json, seeded by scripts/build-2027-plan.js). Syncs are
      // off: this instance is a planning sandbox, it must never push
      // confirmations to organic-cert or pull live actuals into the plan.
      name: 'farm-budget-2027',
      script: 'server.js',
      cwd: './farm-budget',
      env: {
        NODE_ENV: 'production',
        PORT: 3011,
        DATA_FILE: 'data/data-2027.json',
        FIELDOPS_SYNC_ENABLED: 'false',
        CHAT_AGENT_ENABLED: 'false',
      },
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      watch: false,
      max_memory_restart: '256M',
    },

    {
      name: 'fsa-acres',
      script: 'server.js',
      cwd: './fsa-acres',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      watch: false,
      max_memory_restart: '256M',
    },

    {
      name: 'meristem-malt',
      script: 'server.js',
      cwd: './meristem-malt',
      env: {
        NODE_ENV: 'production',
        PORT: 3003,
      },
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      watch: false,
      max_memory_restart: '256M',
    },

    {
      name: 'farm-registry',
      script: 'server.js',
      cwd: './farm-registry',
      env: {
        NODE_ENV: 'production',
        PORT: 3005,
      },
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      watch: false,
      max_memory_restart: '256M',
    },

    {
      name: 'seed-inventory',
      script: 'server.js',
      cwd: './seed-inventory',
      env: {
        NODE_ENV: 'production',
        PORT: 3006,
      },
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      watch: false,
      max_memory_restart: '256M',
    },

    {
      name: 'grain-tickets',
      script: 'server.js',
      cwd: './grain-tickets',
      env: {
        NODE_ENV: 'production',
        PORT: 3007,
      },
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      watch: false,
      max_memory_restart: '256M',
    },
  ],
};
