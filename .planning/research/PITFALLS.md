# Pitfalls Research

**Domain:** Mobile PWA enhancements for existing Next.js 14 / Supabase farm operations portal
**Researched:** 2026-03-20
**Confidence:** MEDIUM — core pitfalls verified across multiple sources; farm-specific combinations inferred from project context

---

## Critical Pitfalls

### Pitfall 1: Offline Sync Conflicts Silently Overwrite Field Data

**What goes wrong:**
The existing `operation-queue` in IndexedDB uses a drain-and-POST approach on reconnect. If two team members (e.g., both in the field with spotty signal) edit the same crop plan record while offline, whichever device syncs last silently wins. The other user's field observations are permanently lost with no warning.

**Why it happens:**
The current sync in `src/lib/offline/crop-plan-sync.ts` queues operations with timestamps but the server-side handler likely applies them in arrival order, not by field-level conflict detection. Last-write-wins based on `modified_at` is the default assumption — simple to implement, catastrophic when farm crew members diverge on the same record.

**How to avoid:**
- Add a `client_version` counter or `device_id` + `local_seq` to every queued operation before building out sync for additional modules.
- Server-side: reject conflicting writes with a 409 Conflict status and return the current server state; client surfaces a merge prompt rather than silently losing data.
- For the small team (2-5 people), a field-level last-write-wins with a visible "last synced by [user] at [time]" audit trail is acceptable — but only if it is visible, never silent.
- Do not extend the existing operation queue pattern to new modules (claims, insurance) without first adding conflict metadata to the schema.

**Warning signs:**
- Operation queue drain logs show no conflict status codes (only 200s) — means conflicts are being silently accepted.
- Team members report data "reverting" after they re-enter the field.
- Multiple devices going offline simultaneously with overlapping data scope.

**Phase to address:** Offline sync phase — before extending IndexedDB caching to any module beyond crop plans.

---

### Pitfall 2: Service Worker Caches Next.js RSC Payloads as Stale HTML

**What goes wrong:**
Next.js App Router uses React Server Component payloads (`?_rsc=...` query parameter) for client-side navigation. If a service worker applies a `stale-while-revalidate` or `cache-first` strategy to `/app/*` routes without excluding RSC payloads, users get stale module data from cache while the server has newer records. This is especially bad for a farm portal where claim deadlines and insurance calculations are time-sensitive.

**Why it happens:**
`next-pwa` (shadowwalker package — unmaintained since ~2022) defaults to `stale-while-revalidate` for navigations, which silently serves cached RSC payloads. The existing service worker registration in `src/app/layout.tsx` must be audited to confirm what strategy is applied to dynamic routes.

**How to avoid:**
- Use `NetworkFirst` for all `/app/*` navigation requests and all `/api/*` routes — never cache-first for dynamic data.
- Use `CacheFirst` only for static assets: fonts, images, JS/CSS bundles with content-hashed filenames.
- Explicitly exclude `_rsc` query parameter URLs from the page cache, or use a `NetworkFirst` strategy with a generous timeout (3-5 seconds) and offline fallback page.
- If using Workbox directly (preferred over unmaintained `next-pwa`), register a separate route handler for RSC payloads.
- Name the service worker file something other than `sw.js` — Next.js 14 uses that name internally for asset precaching.

**Warning signs:**
- After deploying a data change (e.g., adding a new claim), users on mobile still see old data without a hard refresh.
- Chrome DevTools Application → Cache Storage shows RSC response payloads cached under page URLs.
- `next-pwa` version in `package.json` references `shadowwalker/next-pwa` (abandoned) rather than `ducanh-next-pwa` (actively maintained fork).

**Phase to address:** Service worker / caching strategy phase — audit and reconfigure before any new offline features are added.

---

### Pitfall 3: Embedded Express Modules (iframes) Are Invisible to the Service Worker

**What goes wrong:**
The portal has embedded modules (FSA, insurance sub-apps) loaded via iframes pointing to Express apps behind Caddy reverse proxy at `/embed/*`. The main Next.js service worker cannot cache or intercept requests made from inside those iframes — they are in a separate browsing context. On mobile in rural areas, when connectivity drops, iframe-based modules go blank with a browser error rather than a graceful offline fallback.

**Why it happens:**
Service workers are scoped to an origin and browsing context. A service worker registered by the parent page at `portal.whughesfarms.com` does not intercept fetch requests made by an iframe even on the same origin, because the iframe has its own registration scope. The same-origin Caddy proxy keeps iframes on the same origin, which helps, but the Express apps themselves would need their own service worker to handle offline caching of their resources.

**How to avoid:**
- Do not attempt to make iframe-based modules work offline via the parent service worker — this is architecturally impossible.
- For offline resilience: detect connectivity in the parent and overlay an "offline" UI over the iframe before it renders a browser error page.
- Consider wrapping iframe navigation behind a connectivity check: show a toast "Offline — embedded module unavailable" and hide the iframe when `navigator.onLine === false`.
- Long-term: convert the highest-priority embedded module to a native React page (already the pattern for claims, FSA 578 native pages) to gain offline capability.
- Mark iframe modules explicitly in `src/lib/modules.ts` as `offline: false` so the mobile UI can gracefully degrade them.

**Warning signs:**
- Users see a blank or browser-error iframe on mobile when signal drops.
- Chrome DevTools shows no service worker activity on requests originating from the iframe.
- Any attempt to add offline caching for `/embed/*` paths in the service worker produces no effect.

**Phase to address:** Mobile layout / offline phase — add connectivity detection and graceful degradation UI before shipping mobile responsiveness for embedded modules.

---

### Pitfall 4: Mobile Service Worker Update Strands Users on Old App Version

**What goes wrong:**
After deploying a bug fix or data schema change, users who installed the PWA to their home screen continue running the old service worker. New service workers wait in `waiting` state until all tabs are closed — on mobile, tabs are rarely fully closed. Users can operate on a stale app for days without knowing there is an update.

**Why it happens:**
The default service worker lifecycle requires the user to close all tabs before the new worker activates. Farm workers check the portal in the morning, keep it open all day, and rarely notice the update prompt if it exists at all.

**How to avoid:**
- Implement an update notification UI: when `navigator.serviceWorker.waiting` fires, show a banner "New version available — tap to update" that calls `skipWaiting()` and reloads.
- Do not call `skipWaiting()` automatically without user confirmation — this can cause in-progress form submissions or sync operations to be interrupted mid-flight.
- After any data schema change to IndexedDB (adding stores, changing versions), increment the `DB_VERSION` constant in `src/lib/offline/db.ts` — failing to do so causes silent schema mismatch errors in existing installs.

**Warning signs:**
- After a deploy, `navigator.serviceWorker.controller.scriptURL` differs from the current deployed version on some devices.
- Users report seeing data from before a correction was applied.
- No "update available" toast or banner exists in the current codebase.

**Phase to address:** PWA install experience phase — implement update notification before promoting the PWA install prompt.

---

## Moderate Pitfalls

### Pitfall 5: Touch Targets Too Small on Desktop-First Form Layouts

**What goes wrong:**
The existing desktop-first Tailwind layouts likely have form controls sized for mouse precision. On mobile in the field — gloves, direct sunlight, one thumb — a 28px button or a 20px checkbox will generate frequent mis-taps. Users either abandon forms or submit incorrect data.

**Why it happens:**
Tailwind's default utilities (`p-2`, `text-sm`, `gap-2`) produce visually compact forms designed for desktop. Converting desktop-first to mobile-first by adding `sm:` prefixes without auditing minimum touch target sizes is the common shortcut.

**How to avoid:**
- WCAG 2.5.5 requires minimum 44×44px touch targets. Apple HIG recommends 44pt; Google Material recommends 48dp.
- Audit every interactive element (buttons, checkboxes, selects, date pickers) in the four native module pages (FSA 578, insurance, claims, macro rollup) and enforce `min-h-[44px] min-w-[44px]` with adequate spacing.
- For field data entry (observations, notes): use full-width inputs, large font sizes (`text-base` minimum, `text-lg` preferred), and single-column layouts — never multi-column on small screens.
- Avoid dropdowns with many options — on mobile a `<select>` with 30+ crop varieties is painful. Use searchable comboboxes or group options.
- Outdoor use means high ambient light: ensure contrast ratios exceed WCAG AA (4.5:1) for text on all form elements; Tailwind's default `gray-300` borders often fail this on white backgrounds in direct sun.

**Warning signs:**
- Chrome DevTools mobile emulator shows any interactive element under 44px in height.
- Any `text-xs` or `text-sm` form labels without adequate line-height on form inputs.
- Multi-column grid layouts on form pages without `grid-cols-1` breakpoint at `sm`.

**Phase to address:** Mobile layout / responsive design phase.

---

### Pitfall 6: `navigator.onLine` Is Not a Reliable Connectivity Signal for Rural Networks

**What goes wrong:**
The existing sync logic in `src/lib/offline/crop-plan-sync.ts` triggers on reconnect using `navigator.onLine`. In rural areas, `navigator.onLine` returns `true` whenever the device has a network interface — including a signal bar that technically connects but cannot route traffic (common with edge LTE and farm Wi-Fi). The sync triggers, the fetch times out or fails, and the queue operation is marked 'failed' with no retry, silently dropping field data.

**Why it happens:**
`navigator.onLine` reflects the presence of a network interface, not actual internet reachability. Rural signal fluctuates: a device can oscillate between "technically connected" and "effectively offline" every 30 seconds.

**How to avoid:**
- Use a reachability probe (lightweight HEAD request to a known fast endpoint — e.g., `/api/health` or a small Supabase edge function) before attempting sync. Only drain the queue after the probe returns 200.
- Implement exponential backoff with jitter on sync retries: 1s → 2s → 4s → 8s → max 60s. Current code has "retry with backoff" noted in ARCHITECTURE.md but the implementation should be verified.
- Distinguish between `navigator.onLine === false` (definitely offline) and "probe failed" (effectively offline). Show different UI states: "No network" vs "Network unreliable — retrying sync."
- Do not drain the entire operation queue in a single fetch burst. Process operations one at a time (or in small batches of 3-5) so a connection drop mid-sync leaves the queue partially drained rather than corrupted.

**Warning signs:**
- Sync log shows operations going from `queued` to `failed` (not `synced`) immediately after reconnect.
- Users report submitting field data that "disappeared" after a connectivity event.
- No reachability probe visible in `src/lib/offline/crop-plan-sync.ts` — only `navigator.onLine` event listener.

**Phase to address:** Offline sync reliability phase — audit before extending sync to new modules.

---

### Pitfall 7: Desktop Scrolling Tables and Accordions Break on Small Screens

**What goes wrong:**
The FSA CLU workspace renders 1000+ records in grouped accordions. On desktop, wide tables with horizontal scroll work. On mobile, horizontal-scroll tables inside accordions inside a fixed-height sidebar layout produce nested scroll traps — the outer page scroll is hijacked by the inner scroll, making the content impossible to navigate on touch.

**Why it happens:**
Nested overflow containers (`overflow-x-auto` inside `overflow-y-scroll` inside a flex column) create touch event ambiguity. Browsers handle this inconsistently across iOS Safari and Android Chrome.

**How to avoid:**
- Audit all `overflow-x-auto` or `overflow-x-scroll` table containers for mobile. Replace wide tables with stacked card layouts at `sm:` breakpoint — each record becomes a card with label: value pairs.
- The CLU workspace already has a virtualization gap (CONCERNS.md: renders all 1000+ records). This is a mobile crisis: 1000 DOM nodes on a phone causes jank. Implement windowing (`react-virtual` or `@tanstack/react-virtual`) before mobile launch of FSA module.
- Avoid horizontal scroll entirely on mobile — if a table cannot convert to cards, restrict the mobile view to the 3-4 most critical columns and add a "view details" drilldown.
- Test on real devices or BrowserStack with iOS Safari — Chrome DevTools mobile emulation does not reproduce iOS scroll trap behavior.

**Warning signs:**
- `overflow-x-auto` container inside a `flex` or `grid` with `overflow-y-auto` parent.
- Performance tab in Chrome DevTools shows >16ms frame times when scrolling the CLU workspace on a mobile-profile throttle.
- Page has no `sm:grid-cols-1` or `sm:flex-col` breakpoint overrides on any table container.

**Phase to address:** Mobile layout / responsive design phase — FSA module specifically needs virtualization before mobile responsiveness work.

---

### Pitfall 8: PWA Install Prompt Appears Before Users Trust the App

**What goes wrong:**
Showing the "Add to Home Screen" install prompt on first visit before users have experienced the app's value causes immediate dismissal. On iOS Safari specifically, if the user dismisses the native prompt, it cannot be shown again programmatically — they would need to manually use the Share → Add to Home Screen flow indefinitely.

**Why it happens:**
Developers add `beforeinstallprompt` listener and fire it on first meaningful load. Farm workers who are unfamiliar with PWAs dismiss it reflexively. On iOS there is no `beforeinstallprompt` at all — the install must be taught via UI.

**How to avoid:**
- Defer the Android install prompt until after the user has completed at least one meaningful action (e.g., viewed a module, submitted a field observation).
- For iOS: add a persistent but dismissable "Install app" banner in the portal header that explains the benefit ("works offline in the field") and shows step-by-step instructions.
- Never rely solely on the browser's native install prompt — add an explicit in-app install flow.
- Track install state in localStorage; do not re-prompt users who have already installed.

**Warning signs:**
- Install prompt fires on `/dashboard` page load for new users with no engagement gate.
- No iOS-specific install instructions exist in the current `src/components/pwa/` directory.
- No dismissal state stored in localStorage.

**Phase to address:** PWA install experience phase.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Extend existing `operation-queue` to new modules without conflict metadata | Fast to ship offline for claims | Silent data loss when two field users edit same claim offline | Never — add `device_id` and `client_version` from the start |
| `stale-while-revalidate` for all Next.js routes | Simple single-strategy config | Stale claim deadlines and insurance data served from cache | Never for dynamic data — only for static assets |
| `navigator.onLine` as sole connectivity signal | One-line implementation | Failed syncs silently drop field data on rural LTE | Never for sync trigger — use reachability probe |
| Skip mobile testing on real devices, use DevTools emulation only | Faster dev cycle | iOS Safari scroll traps, touch event bugs, and PWA install behavior undetected | Never for PWA/offline features — must test on real iOS Safari |
| Ignore iframe modules during mobile pass | Reduces scope | Blank white iframes on mobile when offline — looks broken | Acceptable in Phase 1 only if iframe modules are explicitly hidden on small screens |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase Realtime (if added) | Using Realtime subscription as primary sync instead of IndexedDB queue | Use IndexedDB queue as source of truth; Realtime as a live UI update layer only. Realtime requires network — not offline-safe. |
| Background Sync API | Registering sync tag without checking browser support; Safari does not support Background Sync as of 2025 | Gate Background Sync behind feature detection (`'SyncManager' in window`); fall back to `navigator.onLine` event for iOS. |
| Supabase mobile auth tokens (`getUser()` only) | Token revocation not checked on every sync call (noted in CONCERNS.md) | Before a sync batch, validate the token is still live. A revoked-but-unexpired token will let sync proceed against Supabase RLS and fail with a 403 mid-queue, corrupting queue state. |
| Caddy + Express iframes | Assuming Caddy same-origin rewrite means service worker covers embedded app resources | Service worker scope does not follow reverse proxy rewrites — the embedded Express app needs its own offline strategy or must be excluded from offline requirements. |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Rendering 1000+ CLU records in DOM on mobile | Scroll jank, 200ms+ interaction latency, device heat | `@tanstack/react-virtual` windowing before mobile launch of FSA module | Immediate on mid-range Android phones |
| Syncing entire operation queue in one fetch burst | Single dropped request fails partial sync with no progress saved | Process queue in batches of 3-5; mark each operation `synced` immediately after its own 200 response | Any time connectivity drops during sync (common in rural LTE) |
| Loading all insurance policies on mount | 5-10 second blank screen on mobile for farms with 100+ policies | Cursor-based pagination; load first 20 on mount, paginate on scroll | ~50 policies on a 3G connection |
| No service worker cache size limit | Cache grows unbounded; iOS evicts entire PWA cache when storage pressure is high | Set `maxEntries` and `maxAgeSeconds` in Workbox runtime caching config | After 2-4 weeks of daily use on a 64GB iPhone |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Service worker caches authenticated API responses | Cached responses served to wrong user if device is shared or after logout | Include `Authorization` header in cache key; on logout, call `caches.delete()` to clear all API response caches |
| IndexedDB data persists after logout | Next user on a shared device (farm office tablet) sees previous user's field data | On logout (`src/app/actions/auth.ts`), call `getDb()` and clear all IndexedDB stores — do not rely on browser-level cleanup |
| Mobile API routes still using service role key (CONCERNS.md) | Full database write access if key leaks from mobile network traffic | Replace with user-scoped Supabase auth tokens before extending mobile API for PWA field data submission |
| Operation queue contains PII / sensitive farm data in plaintext IndexedDB | iOS/Android device backup may include IndexedDB data | Evaluate whether crop plan data is sensitive enough to warrant encryption at rest in IndexedDB (low priority for this team size, but flag) |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No offline indicator in UI | Farm worker submits form, thinks it worked, data is only queued — discovers loss later | Persistent "Offline — data will sync on reconnect" banner when `navigator.onLine === false` or probe fails |
| Sync failure shown only in browser console | Failed field observations silently lost | Show a persistent badge or notification: "3 items pending sync — tap to retry" |
| Date pickers using desktop calendar widget | Finger-impossible to use on phone; requires precise tap on tiny day cells | Use native `<input type="date">` on mobile — browser-native date picker is thumb-friendly and locale-aware |
| Full-width desktop navigation sidebar on mobile | Sidebar collapses viewport space, navigation targets too small | Convert BannerSection / sidebar to a bottom navigation bar (4-5 icons) for mobile, following iOS and Android conventions |
| Form submitting while offline with no feedback | User taps Submit, spinner appears, nothing happens, no explanation | Detect offline state before submission; if offline, immediately queue the operation and show "Saved offline — will sync automatically" |
| Multi-step complex forms with no progress save | Rural connectivity drop mid-form loses all entered data | Auto-save form state to localStorage or IndexedDB on every field change; restore draft on return |

---

## "Looks Done But Isn't" Checklist

- [ ] **Offline mode:** Offline banner exists but only triggers on `navigator.onLine === false` — verify it also triggers when reachability probe fails (the rural LTE scenario)
- [ ] **Operation queue:** Drain-on-reconnect code runs — verify it has exponential backoff implemented, not just documented in ARCHITECTURE.md
- [ ] **Service worker update:** New service worker installs — verify there is a visible "Update available" UI prompt; `skipWaiting()` without UI is a data-loss risk
- [ ] **Logout + IndexedDB:** Logout redirects to `/login` — verify it also clears all IndexedDB stores (`operation-queue`, `crop-plan-cache`) to prevent data bleed on shared devices
- [ ] **Mobile forms:** Forms render on mobile viewport — verify every interactive element meets 44px minimum touch target height in actual device test, not DevTools emulation
- [ ] **Iframe modules on mobile:** Embedded modules display — verify they show a graceful "unavailable offline" state rather than a blank iframe when connectivity is absent
- [ ] **PWA install on iOS:** Install flow works on Android — verify there is an explicit in-app instruction for iOS Safari users (no `beforeinstallprompt` on iOS)
- [ ] **Cache invalidation on deploy:** Service worker updates on next load — verify RSC payload routes use `NetworkFirst`, not `StaleWhileRevalidate`, so fresh data is served after a deploy

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Offline sync conflict silently lost field data | HIGH — data may be unrecoverable | Add server-side `conflict_log` table; implement client `device_id` tracking retroactively; manually reconcile from user recall or paper records |
| Stale RSC payload served from cache after deploy | LOW — force refresh clears it | Add cache-busting query param to navigation routes; instruct users to "pull to refresh" or hard reload; update service worker to use NetworkFirst going forward |
| Service worker update stranded users on old version | MEDIUM — requires users to manually close/reopen PWA | Send push notification or in-app alert prompting users to refresh; document manual "clear site data" process for support |
| IndexedDB data persists after logout on shared device | HIGH if sensitive data — requires manual device-level clear | Immediately implement logout → IndexedDB clear; document "clear site data" in browser settings as interim mitigation |
| 1000-node DOM on mobile FSA module causes crash | MEDIUM — requires adding virtualization | Gate FSA module behind "desktop recommended" banner on mobile until virtualization is implemented |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Offline sync conflict overwrites field data | Offline sync extension phase | Two-device test: both offline, edit same record, reconnect — confirm conflict is surfaced, not silently resolved |
| Stale RSC payloads from service worker | Service worker / caching phase | Deploy a data change; confirm mobile users see updated data without hard refresh |
| iframe modules invisible to service worker | Mobile layout phase | Drop connectivity while on an embedded module; confirm graceful fallback UI, not blank iframe |
| Service worker update strands users | PWA install experience phase | Deploy new service worker; confirm update prompt appears on next app load without closing all tabs |
| Touch targets too small | Mobile layout / responsive phase | Axe DevTools or manual audit: all interactive elements ≥ 44px height on 375px viewport |
| `navigator.onLine` unreliable in rural LTE | Offline sync reliability phase | Simulate "connected but unreachable" using DevTools "slow 3G" + request blocking; confirm sync does not silently fail |
| Desktop scroll tables break on mobile | Mobile layout phase | Test FSA CLU workspace on real iOS Safari and Android Chrome; nested scroll traps are device-specific |
| Install prompt dismissed permanently on iOS | PWA install experience phase | Fresh iOS Safari session; confirm install instructions visible without triggering native prompt |

---

## Sources

- [Offline sync & conflict resolution patterns — Sachith Dassanayake (Feb 2026)](https://www.sachith.co.uk/offline-sync-conflict-resolution-patterns-architecture-trade%E2%80%91offs-practical-guide-feb-19-2026/) — MEDIUM confidence (single source, recent)
- [Offline-first frontend apps 2025: IndexedDB and SQLite — LogRocket](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/) — MEDIUM confidence
- [Next.js discussions: stale data with service worker and GSSP](https://github.com/vercel/next.js/discussions/52024) — HIGH confidence (official Next.js discussion)
- [Next.js discussions: building offline-first App Router PWA](https://github.com/vercel/next.js/discussions/82498) — HIGH confidence (official Next.js discussion)
- [Service Worker in iFrame — digiinvent.com](https://digiinvent.com/service-worker-in-iframe/) — MEDIUM confidence (aligns with MDN scope documentation)
- [Offline and background operation — MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation) — HIGH confidence (official MDN)
- [PWA caching strategies checklist — Zeepalm](https://www.zeepalm.com/blog/pwa-offline-functionality-caching-strategies-checklist) — MEDIUM confidence
- [Mobile form usability — UX Planet / Nick Babich](https://uxplanet.org/mobile-form-usability-2279f672917d) — MEDIUM confidence (widely cited UX source)
- [IndexedDB pain points and oddities — GitHub Gist / pesterhazy](https://gist.github.com/pesterhazy/4de96193af89a6dd5ce682ce2adff49a) — HIGH confidence (community-verified Safari IndexedDB transaction issues)
- [Progressive Web Apps 2026 Performance Guide — digitalapplied.com](https://www.digitalapplied.com/blog/progressive-web-apps-2026-pwa-performance-guide) — LOW confidence (single source, verify independently)
- Project codebase: `src/lib/offline/`, `src/lib/modules.ts`, `src/app/api/mobile/`, `src/middleware.ts`, `.planning/codebase/CONCERNS.md` — HIGH confidence (direct codebase analysis)

---

*Pitfalls research for: Mobile PWA enhancements — Next.js 14 / Supabase farm operations portal*
*Researched: 2026-03-20*
