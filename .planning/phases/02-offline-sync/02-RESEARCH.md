# Phase 2: Offline Sync - Research

**Researched:** 2026-05-18
**Domain:** Offline status UI, queue visibility, conflict handling — glomalin-portal (Next.js 14 / Supabase)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Status indicator**
- Lives in the header/banner area (top of screen)
- Only appears when offline or syncing — silent when the user is online, no persistent "Online" label
- Three states: **Offline** (red), **Syncing** (blue), **Error** (red + error icon)
- Queue count displayed inline in the banner: e.g., "Offline • 3 items queued"

**Queue display**
- Count lives inside the status indicator banner — no separate nav badge
- Banner is tappable — opens a detail drawer/sheet listing queued items
- Queue is read-only: auto-drains on reconnect, no user cancel/delete
- Queue list clears automatically after successful sync — no history retention

**Conflict handling**
- Notification: non-blocking toast + item added to a persistent conflicts list
- Resolution UI: show both versions (local vs server), user taps "Keep mine" or "Keep server version" — two-button choice per conflict
- Unresolved conflicts sit quietly in the list — no blocking, no persistent badge pressure
- Field observations rarely conflict; keep it simple and surface both versions rather than auto-resolving

**Sync completion feedback**
- Successful drain: brief toast "Synced X items" then auto-dismiss
- During active drain: banner shows "Syncing… X items" with a progress indicator (same banner location as Offline state)
- Sync failure (server error, not connectivity): banner stays in Error state (red) with a retry tap target — items remain queued

### Claude's Discretion

- Exact queued item display format (type + timestamp is likely sufficient, but Claude can use whatever is available in the queue record)
- Progress indicator style inside the Syncing banner (spinner, dots, etc.)
- Toast auto-dismiss timing

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MSYNC-01 | User sees a clear online/offline status indicator that updates when connectivity changes, with queue count inline | `useOnlineStatus` hook wrapping window online/offline events already exists in pattern form (`OfflineBanner`, `offline-summary-cards`); new `useSyncStatus` hook merges online state + queue count from `offlineQueue.getPending()` |
| MSYNC-02 | Queued items drain automatically when connectivity is restored; conflicts surface visibly rather than failing silently | `processQueue` in `sync-engine.ts` already handles drain + 409 conflict detection; Phase 2 extends it to write conflict records to IDB and trigger toast + persistent conflict list |
</phase_requirements>

---

## Summary

Phase 2 builds on a solid existing offline foundation already in the glomalin-portal codebase. The `idb` ^8 library is installed, `glomalin-offline` DB at version 3 has `operation-queue`, `observation-queue`, and `sync-config` stores, and `sync-engine.ts` already implements FIFO queue drain with retry, backoff, 409 conflict skip, and auth refresh. What is completely absent is any user-visible sync status UI beyond the narrow `OfflineBanner` (amber strip, offline only) and the `SyncStatus` component buried inside the observations form.

The work for Phase 2 is UI and wiring, not infrastructure: create a `useSyncStatus` hook that merges online/offline state with live queue counts, build a `SyncStatusBanner` that implements the three-state design (Offline/Syncing/Error), add a tappable queue detail sheet using the existing `Sheet` component, and wire in a conflict record store + conflict resolution drawer. No new database libraries, no new sync logic, no new API routes are required for the core banner and queue display work.

Conflict handling requires one new IDB store (`conflicts`) added as DB version 4, and a lightweight API endpoint or a client-side diff that captures both local and server versions when `processQueue` encounters a true data conflict (not a 409 "already confirmed" skip). Given that field observations are the only queued data type in Phase 4 and conflicts are rare, the simplest approach is to let `processQueue` return conflict records with local/server payloads and persist them to IDB for the resolution UI to read.

**Primary recommendation:** Build `useSyncStatus` hook + `SyncStatusBanner` component as the first task. The banner is the linchpin — once it renders correctly in all three states, the queue sheet and conflict drawer can be added incrementally without risking the main user-facing requirement.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `idb` | ^8.0.3 (already installed) | IndexedDB wrapper | Already in use; typed schema; `OfflineDB` interface in `types.ts` |
| `react` | ^18 (Next.js 14) | UI framework | Project standard |
| `next` | 14.2.35 | App Router, layout | Project standard |
| `@supabase/ssr` | ^0.9.0 | Auth token refresh | Used in processQueue token getter |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Tailwind CSS | ^3.4.1 | Styling | All UI — glomalin-* token classes |
| Radix UI Sheet (via project UI) | present in glomalin-portal as direct `@radix-ui` primitives | Queue detail drawer | Banner tap target → side-from-top sheet |
| Lucide React | (project uses lucide-react in organic-cert, portal uses SVG inline) | Icons | Offline, sync spinner, error icons |
| `sonner` | not currently in glomalin-portal dependencies | Toast notifications | Sync complete / conflict toast |

**Note on sonner:** The glomalin-portal `package.json` does NOT include `sonner`. The portal currently shows inline status indicators (amber div, showRefreshed state). For toast notifications required by the sync completion and conflict decisions, either: (a) install `sonner` matching the pattern from organic-cert, or (b) implement toasts as inline auto-dismiss banners using the same `setTimeout` pattern already in `offline-summary-cards.tsx`. Option (b) requires no new dependency and aligns with the existing portal pattern.

**Recommendation:** Use the inline auto-dismiss div pattern (like `showRefreshed` in `offline-summary-cards`) rather than adding `sonner`. Keep the dependency footprint minimal.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline banner state | `sonner` toast | Sonner is cleaner but adds a dependency not in the portal; inline div matches existing pattern |
| IDB conflicts store | Server-side conflict log | Server-side requires API route + DB migration; IDB is sufficient for the rare-conflict use case |
| `window.online` event | Network Information API | Network API gives connectivity type but is poorly supported; `window.online/offline` is universal |

**Installation (if sonner is chosen):**
```bash
cd /Users/glomalinguild/Desktop/my-project-one/glomalin-portal
npm install sonner
```

---

## Architecture Patterns

### Recommended Project Structure

New files for this phase:

```
src/
├── hooks/
│   └── useSyncStatus.ts          # Merged online state + queue counts + sync control
├── components/
│   └── pwa/
│       ├── sync-status-banner.tsx # Three-state banner (Offline / Syncing / Error)
│       └── queue-detail-sheet.tsx # Tappable drawer listing pending items
│   └── offline/
│       └── conflict-drawer.tsx    # Conflict resolution: local vs server, two buttons
├── lib/
│   └── offline/
│       ├── types.ts               # EXTEND: add ConflictRecord interface + OfflineDB v4
│       ├── db.ts                  # EXTEND: add DB_VERSION = 4 + conflicts store
│       └── sync-engine.ts         # EXTEND: return ConflictRecord[] in SyncResult
```

Existing files that will be modified:

- `src/lib/offline/types.ts` — add `ConflictRecord` type and `conflicts` store to `OfflineDB`
- `src/lib/offline/db.ts` — bump `DB_VERSION` to 4, add `conflicts` object store in upgrade path
- `src/lib/offline/sync-engine.ts` — extend `SyncResult` with `conflicts: ConflictRecord[]`, persist to IDB
- `src/app/(protected)/layout.tsx` — mount `SyncStatusBanner` in mobile section (md:hidden context)

### Pattern 1: useSyncStatus Hook

**What:** Single hook that merges `navigator.onLine` state, live pending queue count, sync running flag, error state, and exposes `drainQueue()`.

**When to use:** Mount once at layout level; pass state down to `SyncStatusBanner` as props.

**Example:**
```typescript
// src/hooks/useSyncStatus.ts
'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { offlineQueue } from '@/lib/offline/db'
import { processQueue } from '@/lib/offline/sync-engine'

export type SyncState = 'idle' | 'syncing' | 'error'

export interface SyncStatus {
  isOnline: boolean
  pendingCount: number
  syncState: SyncState
  errorMessage: string | null
  drainQueue: () => void
}

export function useSyncStatus(getToken: () => Promise<string | null>): SyncStatus {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const isSyncing = useRef(false)

  const refreshCount = useCallback(async () => {
    const pending = await offlineQueue.getPending()
    setPendingCount(pending.length)
  }, [])

  const drainQueue = useCallback(async () => {
    if (isSyncing.current || !navigator.onLine) return
    isSyncing.current = true
    setSyncState('syncing')
    setErrorMessage(null)
    try {
      const result = await processQueue(getToken)
      if (result.failed.length > 0 && result.synced === 0) {
        setSyncState('error')
        setErrorMessage(result.failed[0].errorMessage)
      } else {
        setSyncState('idle')
      }
      await refreshCount()
    } finally {
      isSyncing.current = false
    }
  }, [getToken, refreshCount])

  useEffect(() => {
    setIsOnline(navigator.onLine)
    refreshCount()

    const handleOnline = () => { setIsOnline(true); drainQueue() }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [drainQueue, refreshCount])

  return { isOnline, pendingCount, syncState, errorMessage, drainQueue }
}
```

### Pattern 2: SyncStatusBanner Component

**What:** Three-state slim banner — renders nothing when online+idle, renders Offline/Syncing/Error strip otherwise. Tappable when items are queued.

**When to use:** Mounted inside `(protected)/layout.tsx` in the `md:hidden` mobile section, directly above `<main>`.

**Key implementation notes:**
- `mounted` guard (same pattern as `OfflineBanner`) prevents SSR hydration mismatch
- Three states driven entirely by `isOnline`, `pendingCount`, `syncState` props — no internal state
- Tap handler only fires if `pendingCount > 0` (opens queue sheet)
- Color semantics: Offline = `glomalin-danger`, Syncing = `glomalin-info`, Error = `glomalin-danger`

**Example:**
```typescript
// src/components/pwa/sync-status-banner.tsx
'use client'
import { useState } from 'react'
import type { SyncState } from '@/hooks/useSyncStatus'
import { QueueDetailSheet } from './queue-detail-sheet'

interface SyncStatusBannerProps {
  isOnline: boolean
  pendingCount: number
  syncState: SyncState
  errorMessage: string | null
  onRetry: () => void
}

export function SyncStatusBanner({
  isOnline, pendingCount, syncState, errorMessage, onRetry
}: SyncStatusBannerProps) {
  const [sheetOpen, setSheetOpen] = useState(false)

  // Silent when online and idle
  if (isOnline && syncState === 'idle' && pendingCount === 0) return null

  const isError = syncState === 'error'
  const isSyncing = syncState === 'syncing'

  const label = isError
    ? `Sync error${pendingCount > 0 ? ` • ${pendingCount} queued` : ''}`
    : isSyncing
    ? `Syncing… ${pendingCount} item${pendingCount !== 1 ? 's' : ''}`
    : `Offline${pendingCount > 0 ? ` • ${pendingCount} item${pendingCount !== 1 ? 's' : ''} queued` : ''}`

  const bgClass = (isError || !isOnline)
    ? 'bg-glomalin-danger/15 border-glomalin-danger/40 text-glomalin-danger'
    : 'bg-glomalin-info/15 border-glomalin-info/40 text-glomalin-info'

  return (
    <>
      <button
        role="status"
        aria-live="polite"
        onClick={() => pendingCount > 0 && setSheetOpen(true)}
        className={`w-full flex items-center justify-between px-4 py-2 text-xs font-mono border-b ${bgClass} ${pendingCount > 0 ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <span className="flex items-center gap-2">
          {isSyncing && <span className="inline-block size-3 rounded-full border-2 border-current border-t-transparent animate-spin" />}
          {label}
        </span>
        {isError && (
          <button onClick={(e) => { e.stopPropagation(); onRetry() }} className="text-xs underline">
            Retry
          </button>
        )}
        {pendingCount > 0 && !isError && <span className="text-glomalin-muted">›</span>}
      </button>
      <QueueDetailSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  )
}
```

### Pattern 3: Conflict Record IDB Extension

**What:** DB_VERSION bumped to 4 with a `conflicts` store. `ConflictRecord` stores local payload, server payload, type, and resolution state.

**When to use:** `processQueue` writes a conflict record when server returns a 409 with a body containing the server version, or when a custom conflict detection response is returned.

**Example — types.ts addition:**
```typescript
export interface ConflictRecord {
  id: string            // crypto.randomUUID()
  type: 'confirm-pass' | 'add-pass' | 'observation'
  fieldId: string
  operationDate: string
  localPayload: Record<string, unknown>
  serverPayload: Record<string, unknown>
  createdAt: string     // ISO timestamp
  resolved: 0 | 1      // 0 = unresolved, 1 = resolved (number for IDB indexing)
}
```

**Example — db.ts version bump:**
```typescript
const DB_VERSION = 4

// In upgrade():
if (oldVersion < 4) {
  const conflictStore = db.createObjectStore('conflicts', { keyPath: 'id' })
  conflictStore.createIndex('by-resolved', 'resolved')
}
```

### Anti-Patterns to Avoid

- **Rendering banner on SSR:** Use a `mounted` state guard (set in `useEffect`) before rendering anything that reads `navigator.onLine`. The existing `OfflineBanner` shows the correct pattern.
- **Multiple conflicting `window.online` listeners:** `useSyncStatus` is the single source of truth for sync triggering. Do NOT add additional `window.online` listeners in sub-components — pass state down as props.
- **Blocking render on queue count:** `refreshCount()` is async; initialize `pendingCount` to 0 and let it update after mount — never await before render.
- **Overwriting existing conflict skip logic:** The current `processQueue` already skips "already confirmed" 409s silently (correct behavior for pass confirmations). Only write a `ConflictRecord` when the 409 response body contains a server version payload worth showing to the user.
- **DB_VERSION increment without version gate:** Always add `if (oldVersion < N)` guard in the upgrade handler. Existing v3 users must not re-run earlier migrations.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Online/offline detection | Custom WebSocket ping loop | `window.online/offline` events | The events are well-supported and already used in `OfflineBanner` and `offline-summary-cards` — consistent with codebase pattern |
| Queue drain on reconnect | Custom retry scheduler | `processQueue()` in `sync-engine.ts` | Already handles FIFO, backoff, auth refresh, 409 handling, failure classification — do NOT reimplement |
| Drawer/sheet component | Custom modal overlay | `Sheet` component already exists in `src/components/layout/` patterns (via Radix Dialog in organic-cert) | Glomalin-portal uses Radix UI directly — check `src/components/ui/` for Sheet or implement thin wrapper around `@radix-ui/react-dialog` |
| IDB access | Raw IndexedDB API | `getDb()` + `offlineQueue` API from `db.ts` | Typed, singleton, SSR-safe, version-gated already |

**Key insight:** The sync engine, IDB schema, and online event handling are already production-quality. Phase 2 is purely a UI layer on top of existing infrastructure.

---

## Common Pitfalls

### Pitfall 1: SSR Hydration Mismatch on Banner

**What goes wrong:** `navigator.onLine` is `undefined` on the server; if the component renders based on it without a mount guard, React will throw a hydration error or show a flash of incorrect content.

**Why it happens:** Next.js renders components on the server where `navigator` does not exist.

**How to avoid:** Initialize `isOnline` to `true` (optimistic — most users are online) and set actual value in `useEffect`. Use a `mounted` flag to suppress banner render entirely until after hydration. The existing `OfflineBanner` in `src/components/pwa/offline-banner.tsx` shows the exact pattern.

**Warning signs:** Hydration warnings in the console, banner flickering from offline to online on page load.

### Pitfall 2: DB Version Conflict on Existing Installations

**What goes wrong:** A user with the portal already open in a tab has DB version 3. Opening a new tab with the version 4 code fires `onupgradeneeded`, but the old tab holds a connection, causing the upgrade to block indefinitely.

**Why it happens:** IndexedDB version upgrades require all existing connections to close. The idb library handles this with a `blocked` callback but it must be wired.

**How to avoid:** Add a `blocked()` callback to the `openDB` call in `db.ts` that reloads the page (or shows a prompt). The `idb` library supports: `openDB(..., { blocked() { window.location.reload() } })`.

**Warning signs:** Queue operations silently hanging for users who have the portal open in multiple tabs.

### Pitfall 3: Queue Count Staleness

**What goes wrong:** The `pendingCount` shown in the banner becomes stale if items are added by other code paths (e.g., the observations form calls `offlineQueue.add()` independently) without notifying `useSyncStatus`.

**Why it happens:** There is no pub/sub mechanism between `useObservationQueue` (in the form) and `useSyncStatus` (in the layout).

**How to avoid:** Either: (a) lift `useSyncStatus` to layout and pass `refreshCount` callback as a prop/context, or (b) use a simple `CustomEvent` dispatched from `offlineQueue.add()` that `useSyncStatus` listens to. Option (a) is simpler given the small team.

**Warning signs:** Banner shows "2 items queued" while the form shows "1 pending" — counts disagree.

### Pitfall 4: Conflict UI Scope Creep

**What goes wrong:** The conflict resolution screen grows to show all details, diff views, field history — becomes a mini-app instead of a two-button decision.

**Why it happens:** Easy to add "just one more thing" to the conflict view.

**How to avoid:** The conflict drawer shows: type label, field name if available, timestamp, local value, server value, "Keep mine" / "Keep server version" buttons. Nothing else. Persist the user's choice to the conflict record (`resolved: 1`), delete the queued item, and dismiss.

**Warning signs:** Conflict drawer component exceeds 100 lines of JSX.

### Pitfall 5: Retry Logic Duplication

**What goes wrong:** Phase 2 adds a "Retry" button on the Error banner that directly re-attempts the failed API call instead of calling `processQueue()`.

**Why it happens:** It feels simpler to just call the API directly from the button.

**How to avoid:** The Retry button must call `drainQueue()` from `useSyncStatus`, which calls `processQueue()`. The queue engine handles retry counting, backoff, and failure classification — do not bypass it.

---

## Code Examples

### Online/Offline event hook (verified existing pattern)
```typescript
// Source: src/components/pwa/offline-banner.tsx (existing, verified)
useEffect(() => {
  setMounted(true)
  setIsOnline(navigator.onLine)

  function handleOnline() { setIsOnline(true) }
  function handleOffline() { setIsOnline(false) }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}, [])
```

### IDB version-gated upgrade (verified existing pattern)
```typescript
// Source: src/lib/offline/db.ts (existing, verified)
openDB<OfflineDB>(DB_NAME, DB_VERSION, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) { /* store setup */ }
    if (oldVersion < 2) { /* store setup */ }
    if (oldVersion < 3) { /* store setup */ }
    // Phase 2 adds:
    if (oldVersion < 4) {
      const conflictStore = db.createObjectStore('conflicts', { keyPath: 'id' })
      conflictStore.createIndex('by-resolved', 'resolved')
    }
  },
})
```

### processQueue result extension
```typescript
// Source: src/lib/offline/sync-engine.ts (existing — extend SyncResult)
export interface SyncResult {
  synced: number
  skipped: SyncSkip[]
  failed: SyncFailure[]
  conflicts: ConflictRecord[]   // NEW — Phase 2 addition
  total: number
}
```

### Inline auto-dismiss notification (existing portal pattern — no sonner needed)
```typescript
// Source: src/components/dashboard/offline-summary-cards.tsx (existing, verified)
const [showRefreshed, setShowRefreshed] = useState(false)
const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

// After sync drain:
setShowRefreshed(true)
if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
toastTimeoutRef.current = setTimeout(() => setShowRefreshed(false), 3000)
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `OfflineBanner` (amber, offline-only, no queue count) | `SyncStatusBanner` (three states, queue count inline, tappable) | Replaces/extends existing component |
| `SyncStatus` component inside observations form only | Banner in layout — visible from every page | Global status vs. local to one form |
| No conflict record storage | `conflicts` store in IDB v4 | Required for resolution UI |
| Manual retry not exposed | Retry tap target on Error state banner | Surfaced directly |

**Existing in codebase that Phase 2 extends (do not reimplement):**
- `processQueue()` — full sync engine with backoff, retry, auth refresh
- `offlineQueue` — IDB CRUD for operation queue
- `observationQueue` — IDB CRUD for observation queue  
- `OfflineBanner` — SSR-safe online detection pattern (extract to hook)
- `offline-summary-cards` — auto-dismiss inline notification pattern

---

## Open Questions

1. **Sheet component availability in glomalin-portal**
   - What we know: `sheet.tsx` exists in organic-cert's `src/components/ui/`; glomalin-portal uses `@radix-ui` directly
   - What's unclear: Does glomalin-portal have a `Sheet` wrapper, or does the planner need to create one?
   - Recommendation: Check `src/components/ui/` in glomalin-portal before creating — look for `sheet.tsx` or `dialog.tsx`. If absent, create a thin `QueueDetailSheet` directly using `@radix-ui/react-dialog` (portal already uses Radix).

2. **Conflict trigger in current processQueue**
   - What we know: `processQueue` currently treats 409 as "already confirmed — skip silently" (correct for pass confirmations). Field observations do not use `processQueue` at all — they use `useObservationQueue` which has no conflict handling.
   - What's unclear: For observation conflicts, the server would need to return 409 with both versions in the response body. Currently the `/api/observations` route likely just returns 409 without a body.
   - Recommendation: For Phase 2, implement conflict detection only for `QueuedOperation` types (confirm-pass, add-pass) where a server 409 can plausibly include competing data. Observations are fire-and-forget; their "conflict" is just a failed upload, not a competing write.

3. **`useSyncStatus` token getter**
   - What we know: `processQueue` requires a `getToken: () => Promise<string | null>` argument. In the app, this comes from the Supabase session.
   - What's unclear: Where in the layout tree to get the Supabase session client-side for passing to the hook.
   - Recommendation: The `(protected)/layout.tsx` is a server component. `useSyncStatus` must live in a client component child. The pattern is: create a `SyncStatusProvider` client component that calls `createBrowserClient()` from `@supabase/ssr` and wraps the banner + sheet. This matches the auth pattern elsewhere in the portal.

---

## Sources

### Primary (HIGH confidence)
- Direct file read: `src/lib/offline/db.ts` — IDB schema, DB_VERSION, store names, upgrade pattern
- Direct file read: `src/lib/offline/sync-engine.ts` — processQueue, SyncResult, conflict handling
- Direct file read: `src/lib/offline/types.ts` — QueuedOperation, PendingObservation, OfflineDB types
- Direct file read: `src/components/pwa/offline-banner.tsx` — SSR-safe online detection pattern
- Direct file read: `src/components/dashboard/offline-summary-cards.tsx` — inline auto-dismiss notification pattern
- Direct file read: `src/app/(protected)/layout.tsx` — layout structure, mobile section placement
- Direct file read: `src/lib/tokens.ts` — glomalin-danger, glomalin-info, glomalin-success color tokens
- Direct file read: `package.json` (glomalin-portal) — confirmed: `idb ^8` present, `sonner` absent

### Secondary (MEDIUM confidence)
- `idb` library v8 API verified against organic-cert usage (same library, same version range) — `openDB`, typed schema pattern, index query all confirmed working

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — read directly from `package.json`, no guessing
- Architecture: HIGH — all patterns read directly from existing codebase files
- Pitfalls: HIGH — pitfalls derived from actual code patterns observed (version gate pattern, SSR guard, event listener scoping)

**Research date:** 2026-05-18
**Valid until:** 2026-06-18 (stable codebase; 30-day window is conservative)
