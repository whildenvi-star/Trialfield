# Phase 35: VPS Provisioning + Process Management - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

All 8 apps start, restart on crash, and run in production mode from a single PM2 ecosystem config. CORS locked to the portal domain. Production env templates for every app. grain-tickets port made configurable. Both Next.js apps build and start via `next start`.

</domain>

<decisions>
## Implementation Decisions

### VPS & Provider
- Provider-agnostic configuration — all config files, env templates, and PM2 setup must work on any Ubuntu/Debian Linux VPS
- User will choose VPS provider and specs later; no provider-specific tooling
- Minimum documented requirements (Node.js version, RAM, disk) in env templates

### Domain & CORS
- Use placeholder domain `farm.example.com` throughout all config files
- Single env var (e.g., `PORTAL_ORIGIN`) controls the CORS allowlist — easy to swap when real domain is registered
- All Express apps read CORS origin from environment, not hardcoded

### Deployment Model
- Git clone the monorepo on VPS, git pull for updates
- PM2 restart after pull (manual SSH-based deploy)
- No CI/CD, no Docker — simple bare-metal approach for 6-15 users

### Claude's Discretion
- PM2 ecosystem config structure (restart policies, memory limits, log rotation)
- Server directory layout and monorepo organization on disk
- Port assignments for all 8 apps (grain-tickets must be configurable via PORT env var)
- Node.js version recommendation
- .env.example file format and documentation style
- Next.js build script setup (`next build` + `next start`)
- CORS middleware implementation pattern for Express apps

</decisions>

<specifics>
## Specific Ideas

- Git pull + PM2 restart is the deploy workflow — keep it that simple
- User doesn't have infrastructure experience, so env templates and ecosystem config should be well-documented with comments explaining each variable
- Placeholder domain makes it easy to grep-and-replace when real domain is chosen

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 35-vps-provisioning-process-management*
*Context gathered: 2026-03-06*
