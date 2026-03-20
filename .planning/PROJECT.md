# Glomalin Portal Mobile PWA

## What This Is

A mobile-optimized Progressive Web App enhancement for the W. Hughes Farms glomalin portal (portal.whughesfarms.com). Gives a small farm team (2-5 people) quick mobile access to vital farm operations info and the ability to push field data back to the office — all built on the existing Next.js/Supabase infrastructure.

## Core Value

Farm team members can view critical operations data and submit field observations from their phones, even with spotty connectivity, without needing a separate native app.

## Requirements

### Validated

- ✓ Authentication (email/password, session persistence) — existing
- ✓ Module system with access control — existing
- ✓ PWA manifest and service worker — existing
- ✓ Offline IndexedDB caching for crop plans — existing
- ✓ Mobile API routes — existing
- ✓ FSA 578, Insurance, Claims, Macro Rollup modules — existing
- ✓ Guard pattern for API authorization — existing

### Active

- [ ] Mobile-responsive layouts for all core module pages
- [ ] Touch-friendly forms for field data entry
- [ ] Reliable offline mode with sync-on-reconnect
- [ ] Push data from field back to office (observations, notes, updates)
- [ ] Quick-access dashboard optimized for phone screens
- [ ] Improved PWA install experience

### Out of Scope

- Native app (App Store / Play Store) — PWA approach is cheaper and reuses existing code
- New modules — focus is on making existing modules mobile-friendly
- Public-facing features — this is an internal team tool

## Context

- Portal is live at portal.whughesfarms.com on DigitalOcean Droplet
- Stack: Next.js 14 (App Router), Supabase (auth + DB), Tailwind CSS
- Already has: PWA manifest, service worker, IndexedDB offline layer, mobile API routes
- 10 modules defined in src/lib/modules.ts (native React + embedded Express apps)
- Embedded modules use iframes — these will need special mobile handling
- Offline sync already exists for crop plans via src/lib/offline/

## Constraints

- **Budget**: Minimal — enhance existing codebase, no new infrastructure
- **Tech stack**: Must stay within Next.js/Supabase/Tailwind (existing stack)
- **Team**: Small team (2-5) — simple UX, minimal training needed
- **Connectivity**: Rural farm setting — offline-first is critical
- **Deploy target**: Same DigitalOcean Droplet running the portal

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Enhance PWA over native app | Cheaper, reuses existing code, no app store overhead | — Pending |
| Build on existing offline layer | IndexedDB + sync already working for crop plans | — Pending |

---
*Last updated: 2026-03-20 after initialization*
