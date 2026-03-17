---
phase: 44-pwa-infrastructure
plan: 01
subsystem: infra
tags: [pwa, serwist, service-worker, manifest, offline, next.js]

# Dependency graph
requires: []
provides:
  - "@serwist/next service worker generated at build time (public/sw.js, 44KB)"
  - "Web app manifest with Glomalin branding, dark soil theme, icon set"
  - "InstallPrompt client component handling beforeinstallprompt and iOS Safari fallback"
  - "PWA meta tags in layout (manifest link, theme-color, apple-mobile-web-app, apple-touch-icon)"
affects: [45-crop-plan-viewer, 46-field-pass-logger, 47-offline-sync, 48-grain-tickets-pwa]

# Tech tracking
tech-stack:
  added: ["@serwist/next@^9.5.7", "serwist@^9.5.7"]
  patterns:
    - "Service worker entry at src/sw.ts using Serwist class with precacheEntries from __SW_MANIFEST"
    - "withSerwist wraps next.config.mjs; disabled in development to avoid dev asset caching"
    - "InstallPrompt is a client-only component (useEffect + mounted guard) to prevent SSR hydration errors"
    - "7-day localStorage cooldown on install prompt dismiss"

key-files:
  created:
    - glomalin-portal/src/sw.ts
    - glomalin-portal/public/manifest.json
    - glomalin-portal/public/icons/icon-192.png
    - glomalin-portal/public/icons/icon-512.png
    - glomalin-portal/public/sw.js
    - glomalin-portal/src/components/pwa/install-prompt.tsx
  modified:
    - glomalin-portal/package.json
    - glomalin-portal/next.config.mjs
    - glomalin-portal/src/app/layout.tsx
    - glomalin-portal/tsconfig.json

key-decisions:
  - "Service worker disabled in development (disable: process.env.NODE_ENV === 'development') to prevent dev asset caching pollution"
  - "Static public/manifest.json used over Next.js dynamic manifest.ts route — simpler and works with @serwist/next"
  - "WebWorker added to tsconfig lib for ServiceWorkerGlobalScope types; __SW_MANIFEST declared via SerwistGlobalConfig extension"
  - "Icons generated via pure Node.js PNG encoder (no ImageMagick dependency) — #080604 background, G in #C8860A"

patterns-established:
  - "PWA components live in src/components/pwa/ directory"
  - "Client-only browser components use mounted state guard before rendering"

requirements-completed: [PWA-01, PWA-02]

# Metrics
duration: 10min
completed: 2026-03-17
---

# Phase 44 Plan 01: PWA Infrastructure Summary

**@serwist/next service worker with precache + defaultCache runtime caching, Glomalin web app manifest, and beforeinstallprompt/iOS install prompt component wired into Next.js 14 App Router layout**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-17T16:47:33Z
- **Completed:** 2026-03-17T16:57:33Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Installed @serwist/next@9.5.7 and serwist@9.5.7; build generates public/sw.js (44KB) with precache manifest at build time
- Web app manifest with Glomalin name, dark soil theme (#080604), and 192/512px icon placeholders
- InstallPrompt client component handles Chrome (beforeinstallprompt) and iOS Safari (manual Share instructions), with 7-day dismiss cooldown
- All PWA meta tags wired into root layout (manifest, theme-color, apple-mobile-web-app, apple-touch-icon)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @serwist/next, create service worker, web app manifest, and app icons** - `79ce7e1` (feat)
2. **Task 2: Wire manifest into layout and add install prompt component** - `f817115` (feat)

## Files Created/Modified
- `glomalin-portal/src/sw.ts` - Serwist service worker entry with precacheEntries and defaultCache runtime caching
- `glomalin-portal/next.config.mjs` - withSerwist wrapping next config (swSrc: src/sw.ts, disabled in dev)
- `glomalin-portal/public/manifest.json` - PWA manifest with Glomalin branding and dark soil colors
- `glomalin-portal/public/icons/icon-192.png` - 192x192 placeholder icon (dark background, amber G)
- `glomalin-portal/public/icons/icon-512.png` - 512x512 placeholder icon (dark background, amber G)
- `glomalin-portal/public/sw.js` - Generated service worker (44KB, 44250 bytes)
- `glomalin-portal/src/components/pwa/install-prompt.tsx` - Install prompt client component (151 lines)
- `glomalin-portal/src/app/layout.tsx` - Added manifest link, theme-color meta, iOS PWA tags, InstallPrompt component
- `glomalin-portal/package.json` - Added @serwist/next and serwist dependencies
- `glomalin-portal/tsconfig.json` - Added webworker to lib for ServiceWorkerGlobalScope types

## Decisions Made
- Service worker disabled in dev mode to prevent dev asset caching from polluting the cache
- Static manifest.json chosen over Next.js dynamic manifest route — simpler and fully compatible
- TypeScript: extended ServiceWorkerGlobalScope with SerwistGlobalConfig to declare __SW_MANIFEST property (build-time injection)
- PNG icons generated with pure Node.js (no native deps) — functional placeholders the user can replace with branded assets

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript error: __SW_MANIFEST not on ServiceWorkerGlobalScope**
- **Found during:** Task 1 (first build attempt)
- **Issue:** `src/sw.ts` failed type check — `__SW_MANIFEST` is injected by @serwist/next at build time but not declared in TypeScript types
- **Fix:** Extended ServiceWorkerGlobalScope interface with `SerwistGlobalConfig` and explicitly declared `__SW_MANIFEST: (PrecacheEntry | string)[] | undefined`
- **Files modified:** glomalin-portal/src/sw.ts
- **Verification:** `npm run build` succeeds without type errors
- **Committed in:** 79ce7e1 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - TypeScript type declaration for build-time injection)
**Impact on plan:** Required for build to succeed. No scope creep.

## Issues Encountered
- ImageMagick not available on system — generated PNG icons using pure Node.js zlib + CRC32 encoder. Icons are valid PNGs but are functional placeholders; user should replace with branded assets.

## User Setup Required
None — no external service configuration required for PWA infrastructure. To replace placeholder icons, drop branded PNGs at:
- `glomalin-portal/public/icons/icon-192.png` (192x192)
- `glomalin-portal/public/icons/icon-512.png` (512x512)

## Next Phase Readiness
- PWA shell is ready; service worker caches static assets on first production load
- Phase 45 (Crop Plan Viewer) can rely on this infrastructure for offline data caching
- IndexedDB (idb) setup for offline queue will be added in Phase 47 (Offline Sync)
- Note: Service worker only runs in production build — test PWA features with `npm run build && npm run start`

---
*Phase: 44-pwa-infrastructure*
*Completed: 2026-03-17*
