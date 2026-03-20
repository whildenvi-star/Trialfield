# Stack Research

**Domain:** Mobile PWA enhancements — Next.js 14 / Supabase farm operations portal
**Researched:** 2026-03-20
**Confidence:** MEDIUM-HIGH (PWA tooling and push notifications HIGH via official docs; UI library choices MEDIUM via multiple sources; testing tools HIGH)

---

## Context: What Already Exists

The portal already has these PWA building blocks in place. Do NOT re-install or re-implement them:

- PWA manifest (`app/manifest.ts` via Next.js built-in metadata API)
- Service worker registration (in `src/app/layout.tsx`)
- IndexedDB offline layer (`src/lib/offline/` using `idb`)
- Offline sync for crop plans (`src/lib/offline/crop-plan-sync.ts`)
- Tailwind CSS (already installed)
- Supabase auth + DB (already installed)

Research below covers the **gaps**: better service worker management, expanded offline sync, push notifications, mobile-optimized UI components, and testing tools.

---

## Recommended Stack

### PWA Tooling

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@serwist/next` | ^9.5.7 | Service worker with Workbox precaching + runtime caching | Actively maintained successor to abandoned `next-pwa`; officially linked from Next.js PWA docs; built on Google Workbox; last published March 2026 |
| `serwist` | ^9.5.7 | Core Serwist service worker primitives (dev dep) | Companion package required by `@serwist/next`; provides `defaultCache`, `Serwist` class |
| Native Next.js manifest | Built-in | PWA manifest generation | Next.js 14+ App Router has built-in `app/manifest.ts` support — no library needed; already in use |
| `web-push` | ^3.6.7 | Server-side VAPID push notification delivery | Official recommendation in Next.js PWA docs; used in Next.js Server Actions; no third-party service required, self-hosted on droplet |

**Confidence:** HIGH — Serwist versions verified via npm search (9.5.7 published ~March 2026). Next.js PWA guide (updated Feb 2026) explicitly references Serwist for offline support and `web-push` for push notifications.

### Offline-First Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `dexie` | ^4.x | Full-featured IndexedDB wrapper with reactive queries | Expand offline layer beyond crop plans; `useLiveQuery` hook provides React-reactive reads; schema versioning handles migrations cleanly |
| `@tanstack/react-query` | ^5.x | Server state management + offline-first query persistence | Add `networkMode: 'offlineFirst'` + `persistQueryClient` plugin to cache API responses in IndexedDB; existing portal likely uses fetch directly — TanStack Query adds retry, stale-while-revalidate, and offline queuing |
| `@tanstack/query-sync-storage-persister` | ^5.x | Persist TanStack Query cache to localStorage/IndexedDB | Lightweight companion to TanStack Query for persisting cache across sessions |

**Note on existing `idb` package:** The portal already uses `idb` (low-level IndexedDB wrapper) in `src/lib/offline/`. Keep it for the existing crop-plan sync machinery. Add `dexie` for any new offline stores (field observations, notes) where reactive queries and schema migrations are needed. Mixing both is acceptable — they don't conflict.

**Confidence:** MEDIUM — Dexie v4 verified via npm; TanStack Query v5 persistQueryClient verified via official docs at tanstack.com/query/v5/docs. Specific version numbers for `@tanstack/query-sync-storage-persister` based on official docs pattern, not independently version-verified.

### Mobile UI Components

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `konsta` | ^2.x (v5 design) | Native iOS + Material Design mobile components built with Tailwind | Touch-optimized forms, bottom sheets, action sheets, mobile nav — critical for field data entry UX on small screens |
| Tailwind CSS utilities | Already installed | Custom responsive layouts | Continue using for all layout work; `touch-action`, `select-none`, safe-area insets via `env(safe-area-inset-*)` |
| `sonner` | ^1.x | Toast notifications (in-app) | Lightweight, Tailwind-compatible, handles mobile gestures; use for sync status, offline/online indicators, field submission confirmations |

**Important nuance on Konsta UI:** Konsta provides native-feeling components (lists, form inputs, bottom sheets, FABs) styled with Tailwind. Install selectively — only for components where the native mobile feel matters (form inputs, navigation, action sheets). Do not wholesale replace existing Tailwind components with Konsta; use it for new mobile-first screens only.

**Confidence:** MEDIUM — Konsta UI verified at konstaui.com with Next.js integration guide. v5 references "iOS 26 and Material Design 2025" per their site. Exact npm version resolved from search as `npm i konsta`. Sonner verified via shadcn/ui integration and LogRocket 2025 comparison article.

### Push Notifications

| Technology | Version | Purpose | When to Use |
|------------|---------|---------|-------------|
| `web-push` | ^3.6.7 | Server-side: send push messages to subscribed browsers | Farm team alerts (weather events, task assignments, sync errors) triggered from Next.js Server Actions |
| Browser Push API + VAPID | Native | Client-side: subscribe browser to push endpoint | Generate VAPID keys once via `web-push generate-vapid-keys`; store public key in `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, private in `VAPID_PRIVATE_KEY` |
| Supabase table: `push_subscriptions` | — | Store per-user push subscription objects | Replace the in-memory subscription stub in official docs; query by user_id to support multi-device; existing Supabase DB is already available |

**Push browser support (verified March 2026):**
- Chrome/Edge/Opera: Full support (Chrome 50+)
- Firefox: Full support
- Safari: 16.4+ when installed to home screen; Safari 16+ on macOS 13+
- iOS Safari: Requires "Add to Home Screen" install — PWA must be in standalone mode

**Confidence:** HIGH — Next.js official PWA docs (updated Feb 2026) provide complete `web-push` integration example using Server Actions. Browser support verified against MDN Push API docs.

### Mobile Testing Tools

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| `@playwright/test` | ^1.x | E2E mobile emulation, offline simulation, PWA flow testing | Primary automated testing; supports iPhone/Android device profiles, touch emulation, offline network mode via `context.setOffline(true)` |
| `lighthouse` / `@lhci/cli` | ^0.15.x | PWA audit scoring (installability, offline, performance, accessibility) | Run in CI to prevent PWA score regressions; `lhci autorun` with `next dev --experimental-https` for local HTTPS |
| Chrome DevTools | Built-in | Service worker debugging, cache inspection, offline toggling | Primary dev-time tool; Application tab shows service worker state, cache storage, and background sync queue |
| `next dev --experimental-https` | Next.js built-in | Local HTTPS for push notification testing | Push API and service worker install require HTTPS; Next.js CLI flag provides self-signed cert locally |

**Confidence:** HIGH — Playwright device emulation and offline testing verified via Playwright official docs. Lighthouse CI (LHCI) verified via GitHub GoogleChrome/lighthouse-ci. `next dev --experimental-https` referenced in official Next.js PWA docs.

---

## Installation

```bash
# PWA service worker (replaces/supplements existing sw.js)
npm install @serwist/next
npm install -D serwist

# Push notifications (server-side)
npm install web-push
npm install -D @types/web-push

# Expanded offline layer (add alongside existing idb)
npm install dexie

# Server state + offline query persistence
npm install @tanstack/react-query @tanstack/query-sync-storage-persister

# Mobile UI components
npm install konsta

# In-app toast notifications
npm install sonner

# Testing
npm install -D @playwright/test @lhci/cli
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@serwist/next` | `next-pwa` (shadowwalker) | Never — `next-pwa` has not been maintained since ~2022; breaks with Next.js 14+ App Router |
| `@serwist/next` | Manual `public/sw.js` | If Serwist's webpack requirement conflicts with Turbopack migration plans; manual gives full control but loses Workbox precaching |
| `web-push` (self-hosted) | Firebase Cloud Messaging (FCM) | Only if you need multi-channel (mobile native + web) notifications and are willing to add Google dependency; overkill for 2-5 person farm team |
| `dexie` | `idb` (existing) | Stick with `idb` for existing crop-plan sync — only reach for Dexie when you need reactive queries (`useLiveQuery`) or schema versioning for new stores |
| `konsta` | Radix UI / shadcn | shadcn is better for desktop dashboard UX; Konsta is better specifically for mobile-native-feeling forms and navigation on small screens |
| `@tanstack/react-query` | SWR | TanStack Query v5 has more mature offline support (`networkMode: 'offlineFirst'`, persistQueryClient) vs SWR's limited offline story |
| Playwright | Cypress | Playwright handles offline simulation and multi-browser (including WebKit/Safari) in CI; Cypress cannot simulate true offline mode and WebKit support is limited |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `next-pwa` (npm: `next-pwa`) | Abandoned since ~2022; not compatible with Next.js 14 App Router; last meaningful commit 3+ years ago | `@serwist/next` ^9.5.7 |
| Background Sync API directly | Only 78.75% browser support — critically, **Safari (all versions) and Firefox do not support it**; farm team likely uses iPhone browsers | Manual sync-on-reconnect via `navigator.onLine` event + `window.addEventListener('online', ...)` — already implemented in existing `crop-plan-sync.ts`; extend this pattern |
| `workbox-background-sync` | Known broken on iOS Safari (where push subscription requires home screen install); stored requests fail silently; longstanding open GitHub issues | Use the existing manual queue-drain approach in `src/lib/offline/crop-plan-sync.ts` — extend for new stores rather than switching to workbox-background-sync |
| RxDB / PouchDB / ElectricSQL | Full local-first sync platforms — significant architecture change and new infra dependency; Supabase is already the sync backend | `dexie` for local storage + existing Supabase API for sync; keep Supabase as source of truth |
| `react-hot-toast` | Still maintained but superseded by `sonner` for modern Next.js/Tailwind stacks; less mobile-gesture-friendly | `sonner` ^1.x |
| `@capacitor/core` | Capacitor wraps web apps for native app stores — out of scope per PROJECT.md constraints; adds native build pipeline overhead | Keep PWA-only approach per project decision |

---

## Stack Patterns by Variant

**For new offline data stores (field observations, notes):**
- Use `dexie` with typed schema + `useLiveQuery` hook
- Sync to Supabase via existing API route pattern
- Add `networkMode: 'offlineFirst'` to TanStack Query mutations

**For extending the service worker (caching new routes/assets):**
- Add routes to `@serwist/next` `runtimeCaching` config in `next.config.js`
- Use `NetworkFirst` strategy for API routes (freshest data when online, cached when offline)
- Use `CacheFirst` for static assets (icons, fonts)

**For push notifications (Supabase-stored subscriptions):**
- Create `push_subscriptions` table: `id, user_id, subscription_json, created_at`
- Store subscription in Server Action after browser `pushManager.subscribe()`
- Send from any Next.js API route or Server Action via `webpush.sendNotification()`

**For iOS install (mandatory for push on iPhone):**
- Detect `isIOS && !isStandalone` in a client component
- Show persistent install banner explaining "tap Share > Add to Home Screen"
- Do NOT use `beforeinstallprompt` — it does not fire on Safari iOS

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@serwist/next` ^9.5.7 | Next.js 14+, webpack (not Turbopack) | Serwist docs explicitly notes webpack requirement; Turbopack support is a separate `@serwist/turbopack` package (alpha) |
| `dexie` ^4.x | Modern browsers, service workers | Works in service worker context for bg sync patterns; v4 adds `useLiveQuery` improvements |
| `@tanstack/react-query` ^5.x | React 18+, Next.js 14+ App Router | v5 is a breaking change from v4; if portal currently has v4 installed, plan migration carefully |
| `web-push` ^3.6.7 | Node.js 18+; runs server-side only | Never import in client components; use Server Actions or API routes exclusively |
| `konsta` ^2.x | Tailwind CSS 3.x | Requires Tailwind; add `konsta/config` to `tailwind.config.js` plugins |

---

## Sources

- [Next.js PWA Official Guide](https://nextjs.org/docs/app/guides/progressive-web-apps) — verified Feb 2026; confirms Serwist for offline, web-push for notifications, HTTPS requirement, iOS install instructions
- [Serwist Getting Started](https://serwist.pages.dev/docs/next/getting-started) — version 9.5.7 confirmed via npm search (published ~March 2026)
- [next-pwa abandonment confirmed](https://javascript.plainenglish.io/building-a-progressive-web-app-pwa-in-next-js-with-serwist-next-pwa-successor-94e05cb418d7) — multiple sources confirm last meaningful commit ~2022; Medium/DEV community consensus HIGH
- [Background Sync API — Can I Use](https://caniuse.com/background-sync) — 78.75% global support; Safari all versions unsupported; Firefox unsupported as of March 2026
- [TanStack Query v5 persistQueryClient](https://tanstack.com/query/v5/docs/react/plugins/persistQueryClient) — official docs; `networkMode: 'offlineFirst'` pattern confirmed
- [Konsta UI — Next.js Integration](https://konstaui.com/react/next-js) — install guide verified; v5 "iOS 26 + Material Design 2025" per site
- [Dexie.js](https://dexie.org/) — official site; v4 confirmed; `useLiveQuery` for React reactive queries
- [web-push npm](https://www.npmjs.com/package/web-push) — official npm page (403 on direct fetch; version from Next.js docs example confirmed as ^3.x)
- [Playwright PWA/mobile testing](https://playwright.dev/docs/emulation) — offline mode `context.setOffline(true)` confirmed; iPhone/Android device profiles confirmed
- [workbox-background-sync iOS issues](https://github.com/GoogleChrome/workbox/issues/2386) — longstanding open issue confirms Safari unreliability; LOW confidence avoided

---
*Stack research for: Mobile PWA enhancements — W. Hughes Farms glomalin portal*
*Researched: 2026-03-20*
