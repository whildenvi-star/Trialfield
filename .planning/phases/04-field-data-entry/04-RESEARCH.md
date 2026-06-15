# Phase 4: Field Data Entry — Research

**Researched:** 2026-03-22
**Domain:** PWA offline queue, mobile photo capture, IndexedDB sync, Next.js App Router file upload
**Confidence:** HIGH (core patterns verified via official docs and cross-referenced sources)

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FIELD-01 | User can submit a field observation with a text note from their phone | New Prisma model `FieldObservation`, API route `POST /api/observations`, mobile-friendly form component |
| FIELD-02 | User can attach a photo to a field observation before submitting | `<input type="file" accept="image/*" capture="environment">`, client-side canvas resize, `FormData` multipart upload, disk storage at `uploads/observations/` (mirrors existing `uploads/reports/` pattern) |
| FIELD-03 | Observations submitted while offline queue locally and sync automatically when connectivity returns; user receives confirmation when sync completes | IndexedDB queue via `idb` library, `window.online` event handler, sync-on-reconnect, `sonner` toast confirmation |
</phase_requirements>

---

## Summary

Phase 4 delivers a mobile field observation form that works even when the farm crew is in areas with no signal. The three requirements break cleanly into three sub-problems: (1) a simple text observation form with server persistence, (2) photo attachment before submit, and (3) an offline queue that automatically drains when connectivity returns and notifies the user on success.

The good news is this project already has nearly all the infrastructure needed. The `uploads/` directory and disk-write pattern exist in the reports API. The `sonner` toast library is installed. `getAuthContext()` + RBAC guards are established. IndexedDB is referenced in project context (crop plan offline caching). What Phase 4 adds is: one new Prisma model, one upload API route, one client-side offline queue hook using `idb`, and a form component.

The critical constraint for offline queuing is **Background Sync API browser support**: it is Chromium-only in 2025/2026 — Safari and Firefox do not support it. The correct fallback (and frankly the right approach for this farm app) is the `window.addEventListener('online', ...)` pattern with IndexedDB — this works across all browsers and covers the reconnect case when the app is open. This matches the pattern recommended by the LogRocket Next.js 16 offline guide and is what the existing crop plan offline layer uses.

**Primary recommendation:** Implement FIELD-01 first (text-only observation + server API), then add FIELD-02 (photo capture + multipart upload), then add FIELD-03 (IndexedDB queue + online-event sync). Each step is independently deployable and testable on a phone.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `idb` | ^8.0.3 | Promise-based IndexedDB wrapper | Maintained by Jake Archibald (Google Chrome team); tiny (~1.19kB brotli); full TypeScript types; works in all modern browsers including Safari |
| Next.js built-in `fs` + `path` | (Node.js built-in) | Write uploaded images to `uploads/observations/` on disk | Already used by reports API; no new library; Droplet is a persistent VM (not App Platform), so disk storage is durable |
| `sonner` | ^2.0.7 (already installed) | Toast notification when queued observation syncs | Already in the project |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | ^4.3.6 (already installed) | Validate observation API request body | Consistent with existing API validation pattern |
| Browser `canvas` API | (built-in) | Resize photo client-side before upload | Use to compress/resize to ≤1MP before queuing to IndexedDB or uploading; avoids storing 4MB RAW iPhone photos in IndexedDB |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `idb` | `dexie` | Dexie is more opinionated with a schema migration system — useful for large apps. For a single-object-store queue, `idb` is simpler and smaller. |
| `idb` | Raw IndexedDB API | Raw API requires nested callbacks / error handling — not worth it when `idb` wraps it cleanly |
| Background Sync API (service worker) | `window.addEventListener('online', ...)` | Background Sync only works in Chromium. Farm crew may use iPhones. The `online` event works everywhere and fires within seconds of reconnection when the app is open. |
| Disk storage (`fs`) | S3/DigitalOcean Spaces | Spaces requires an API key, SDK, and billing. Disk on the Droplet is already used for PDFs. No new infrastructure needed. |

**Installation:**
```bash
npm install idb
```
No other new packages needed. Everything else is already in the project.

---

## Architecture Patterns

### Recommended Project Structure

New and modified files only. Existing paths untouched.

```
src/
├── app/
│   ├── (app)/
│   │   └── observations/
│   │       └── new/
│   │           └── page.tsx        NEW: mobile field observation form page
│   └── api/
│       └── observations/
│           └── route.ts            NEW: POST (create observation + optional photo upload)
│                                       GET  (list observations for current user/farm)
│
├── components/
│   └── observations/
│       ├── ObservationForm.tsx     NEW: 'use client' — text + photo input, offline-aware
│       └── SyncStatus.tsx          NEW: 'use client' — shows queued count + syncing state
│
├── hooks/
│   └── useObservationQueue.ts      NEW: IndexedDB queue logic, online event, sync trigger
│
└── lib/
    └── observation-db.ts           NEW: idb open/read/write helpers for observation queue

uploads/
└── observations/                   NEW: photo storage (mirrors uploads/reports/ pattern)

prisma/
└── schema.prisma                   MODIFY: add FieldObservation model
```

### Pattern 1: Optimistic Local Write → Online Upload

**What:** When the user submits the form, always write to IndexedDB first, then immediately attempt the network upload. If the upload succeeds, mark the IndexedDB record as `synced: true` and show a toast. If offline or the upload fails, leave it in the queue — the `online` event handler will retry.

**When to use:** Every observation submission regardless of online state. This is simpler than two code paths (one for online, one for offline) and more resilient.

**Example:**
```typescript
// Source: idb docs + LogRocket Next.js 16 PWA guide pattern
// hooks/useObservationQueue.ts

import { openDB } from 'idb';

const DB_NAME = 'observation-queue';
const STORE_NAME = 'pending';

export async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'localId',
          autoIncrement: true,
        });
        store.createIndex('synced', 'synced');
      }
    },
  });
}

export async function queueObservation(payload: PendingObservation) {
  const db = await getDB();
  return db.add(STORE_NAME, { ...payload, synced: false, createdAt: Date.now() });
}

export async function getPendingObservations() {
  const db = await getDB();
  const index = db.transaction(STORE_NAME).store.index('synced');
  return index.getAll(IDBKeyRange.only(false));
}

export async function markSynced(localId: number) {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const record = await tx.store.get(localId);
  if (record) await tx.store.put({ ...record, synced: true });
  await tx.done;
}
```

### Pattern 2: Online Event Triggers Sync Drain

**What:** A `useEffect` in the root layout or the `SyncStatus` component registers a `window.addEventListener('online', syncPending)` handler. When connectivity returns, `syncPending()` iterates the pending queue and fires the upload API for each unsent observation.

**When to use:** As the primary sync trigger. Works on all browsers including Safari (iOS) and Firefox. Fires within 1-3 seconds of network restoration.

**Example:**
```typescript
// Source: MDN 'online' event docs + LogRocket Next.js 16 guide
// hooks/useObservationQueue.ts (continued)

export function useSyncOnReconnect(onSyncComplete: (count: number) => void) {
  useEffect(() => {
    async function syncPending() {
      const pending = await getPendingObservations();
      let synced = 0;
      for (const obs of pending) {
        try {
          await uploadObservation(obs);   // POST /api/observations
          await markSynced(obs.localId);
          synced++;
        } catch {
          // Leave in queue — will retry on next online event
        }
      }
      if (synced > 0) onSyncComplete(synced);
    }

    window.addEventListener('online', syncPending);
    // Also try sync on mount (in case app was opened while reconnected)
    if (navigator.onLine) syncPending();

    return () => window.removeEventListener('online', syncPending);
  }, []);
}
```

### Pattern 3: Mobile Photo Capture with `<input capture>`

**What:** Use a standard HTML file input with `accept="image/*"` and `capture="environment"` attributes. On mobile, this opens the device camera or photo library. No `getUserMedia` or canvas streaming needed — the simpler input approach works for this use case (single photo per observation).

**When to use:** Single photo attachment. If multi-photo or live preview is needed, `getUserMedia` is the upgrade path. For v1.0 field data entry, one photo is sufficient.

**Example:**
```tsx
// Source: MDN capture attribute docs, verified by multiple PWA guides
// components/observations/ObservationForm.tsx

<input
  type="file"
  accept="image/*"
  capture="environment"
  onChange={handlePhotoSelected}
  className="sr-only"
  ref={photoInputRef}
/>
<Button
  type="button"
  variant="outline"
  onClick={() => photoInputRef.current?.click()}
>
  Attach Photo
</Button>
```

### Pattern 4: Client-Side Canvas Resize Before Queue/Upload

**What:** Phone cameras produce 3-12MB photos. Before storing in IndexedDB or uploading, resize to a max of 1200px on the longest edge at 0.8 quality JPEG. This makes the offline queue practical and uploads fast over spotty farm connectivity.

**When to use:** Always, before writing the photo blob to IndexedDB or FormData.

**Example:**
```typescript
// Source: MDN Canvas API + imagekit.io resize pattern
async function resizeImage(file: File, maxPx = 1200): Promise<Blob> {
  const img = await createImageBitmap(file);
  const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise(resolve =>
    canvas.toBlob(blob => resolve(blob!), 'image/jpeg', 0.8)
  );
}
```

### Pattern 5: Multipart Upload in Next.js App Router

**What:** The API route receives a `FormData` POST via `request.formData()`. No body parser configuration needed — App Router handles `multipart/form-data` natively. The photo file is written to disk at `uploads/observations/` using the same `fs.writeFile` pattern used by `uploads/reports/`.

**When to use:** Every observation with a photo. Text-only observations use `application/json`.

**Example:**
```typescript
// Source: Next.js App Router FormData docs + existing reports/generate/route.ts pattern
// app/api/observations/route.ts

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const contentType = request.headers.get('content-type') ?? '';
  let note: string, fieldId: string | undefined, photoPath: string | undefined;

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    note = form.get('note') as string;
    fieldId = form.get('fieldId') as string | undefined;
    const file = form.get('photo') as File | null;
    if (file) {
      const uploadsDir = path.join(process.cwd(), 'uploads', 'observations');
      await fs.mkdir(uploadsDir, { recursive: true });
      const filename = `obs-${Date.now()}-${crypto.randomUUID()}.jpg`;
      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(path.join(uploadsDir, filename), buffer);
      photoPath = filename;
    }
  } else {
    const body = await request.json();
    note = body.note;
    fieldId = body.fieldId;
  }

  const observation = await prisma.fieldObservation.create({
    data: {
      farmId: ctx.farmId,
      submittedById: ctx.id,
      fieldId: fieldId ?? null,
      note,
      photoPath: photoPath ?? null,
    },
  });

  return NextResponse.json(observation, { status: 201 });
}
```

### Anti-Patterns to Avoid

- **Storing full-resolution photos in IndexedDB:** A 4MB photo blob in IndexedDB is slow to read, write, and upload over a spotty connection. Always resize client-side first.
- **Using Background Sync API as the primary sync mechanism:** It is Chromium-only. Farm crew on iPhones will never get sync. Use `window.online` event instead.
- **Separate online/offline code paths:** Don't check `navigator.onLine` at submit time and branch to two different paths. Always queue to IndexedDB, then immediately attempt upload — this is one code path that handles both states.
- **Relying on `navigator.onLine` alone for connectivity:** `navigator.onLine` returns `true` when connected to a local network even if there's no internet. A real-world check is to attempt the POST and handle the network error — but for a simple farm tool, the `online` event is sufficient.
- **Not cleaning up synced records from IndexedDB:** Mark as `synced: true` immediately after success. Optionally purge records older than 7 days to keep the queue clean.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB promise wrapper | Custom promisify layer around `window.indexedDB` | `idb` ^8 | Jake Archibald's library handles version upgrades, transaction error propagation, cursor async iteration — all edge cases that raw IDB gets wrong silently |
| Image resize | Custom imageresizer with complex dimension logic | `canvas.toBlob()` + `createImageBitmap()` | Browser-native, no dependency, handles EXIF rotation in Safari correctly via `createImageBitmap` |
| Offline detection | Polling with `setInterval` | `window.addEventListener('online', ...)` | Browser event fires within seconds; polling wastes battery and is imprecise |

**Key insight:** This domain looks like it needs specialized libraries but it doesn't — `idb` is the only new dependency. Everything else uses existing Next.js APIs, browser APIs, and already-installed packages.

---

## Common Pitfalls

### Pitfall 1: EXIF Rotation on Mobile Photos

**What goes wrong:** iPhone and Android photos often have EXIF orientation data (rotated 90°). When drawn to canvas without handling EXIF, the photo appears sideways.

**Why it happens:** `canvas.drawImage()` does not read EXIF. The file is stored with metadata saying "rotate 90°" but canvas ignores it.

**How to avoid:** Use `createImageBitmap(file)` instead of creating an `<img>` element. As of 2022, `createImageBitmap` in Chrome and Safari automatically applies EXIF orientation. This is the correct fix in 2025/2026.

**Warning signs:** Test specifically with photos taken in portrait orientation. If they appear landscape-rotated, EXIF handling is needed.

### Pitfall 2: IndexedDB Not Available in Safari Private Mode

**What goes wrong:** IndexedDB throws an error in Safari Private Browsing mode. Writes fail silently or throw.

**Why it happens:** Safari's Private Browsing restricts IndexedDB to prevent tracking.

**How to avoid:** Wrap `getDB()` in a try/catch. If IndexedDB is unavailable, fall back to attempting direct upload (no offline queue). This is a graceful degradation, not a blocking failure — farm crew are unlikely to use Private Browsing.

**Warning signs:** Test in Safari Private mode; the queue hook should not throw uncaught errors.

### Pitfall 3: FormData Body Parser Conflict

**What goes wrong:** The Next.js API route receives a multipart request but body parsing fails or returns empty.

**Why it happens:** In the Pages Router, you had to disable the body parser manually. In App Router, `request.formData()` is native — no config needed. The pitfall is accidentally using the Pages Router `export const config = { api: { bodyParser: false } }` pattern in an App Router route.

**How to avoid:** App Router route handlers do NOT need bodyParser config. Just call `await request.formData()` directly.

### Pitfall 4: Missing `uploads/observations/` Directory on First Deploy

**What goes wrong:** The API route fails on first photo upload because the directory doesn't exist.

**Why it happens:** `fs.writeFile` throws if the directory is missing.

**How to avoid:** Use `fs.mkdir(uploadsDir, { recursive: true })` before every write — mirrors the existing `uploads/reports/` pattern. The `recursive: true` option is a no-op if the directory already exists.

### Pitfall 5: IDB Queue Growing Unbounded

**What goes wrong:** Every failed sync attempt keeps the record in the queue indefinitely. After weeks offline or repeated failures, the queue contains hundreds of stale entries.

**How to avoid:** On sync drain, purge `synced: true` records older than 7 days. Add a `createdAt` field to the queue record and filter on purge.

---

## Code Examples

Verified patterns from official sources:

### Open idb Database for Observation Queue
```typescript
// Source: https://github.com/jakearchibald/idb — verified idb 8.x API
import { openDB, type IDBPDatabase } from 'idb';

interface PendingObservation {
  localId?: number;     // autoIncrement key
  note: string;
  fieldId?: string;
  photoBlob?: Blob;     // resized JPEG blob, stored directly in IDB
  synced: boolean;
  createdAt: number;    // Date.now()
}

export async function openObservationDB(): Promise<IDBPDatabase> {
  return openDB('observation-queue', 1, {
    upgrade(db) {
      const store = db.createObjectStore('pending', {
        keyPath: 'localId',
        autoIncrement: true,
      });
      store.createIndex('synced', 'synced');
    },
  });
}
```

### Prisma Model for FieldObservation
```prisma
// Add to prisma/schema.prisma
model FieldObservation {
  id            String   @id @default(cuid())
  farmId        String
  farm          Farm     @relation(fields: [farmId], references: [id])
  fieldId       String?
  field         Field?   @relation(fields: [fieldId], references: [id])
  submittedById String
  submittedBy   User     @relation(fields: [submittedById], references: [id])
  note          String
  photoPath     String?  // relative filename under uploads/observations/
  createdAt     DateTime @default(now())

  @@index([farmId, createdAt])
  @@index([fieldId])
}
```

### Mobile Form with Photo Capture
```tsx
// Source: MDN capture attribute + standard React pattern
// components/observations/ObservationForm.tsx
'use client';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export function ObservationForm() {
  const photoRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState('');

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
  }

  return (
    <form>
      <Textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Describe what you observed..."
        rows={4}
      />
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handlePhotoChange}
      />
      <Button type="button" variant="outline"
        onClick={() => photoRef.current?.click()}>
        {preview ? 'Change Photo' : 'Attach Photo'}
      </Button>
      {preview && (
        <img src={preview} alt="Preview" className="w-full rounded-md mt-2" />
      )}
    </form>
  );
}
```

### Serving Uploaded Photos

The photo is stored as a filename in the DB (`obs-1234-uuid.jpg`). To serve it, add a simple API route:

```typescript
// app/api/observations/photo/[filename]/route.ts
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(_: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  // Sanitize: strip any path traversal
  const safe = path.basename(filename);
  const filePath = path.join(process.cwd(), 'uploads', 'observations', safe);
  const buffer = await fs.readFile(filePath);
  return new Response(buffer, {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'max-age=86400' },
  });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next-pwa` (shadowwalker) | Serwist or manual `public/sw.js` | 2024 | next-pwa is unmaintained; Serwist is the maintained fork; for this phase, a manual SW is sufficient since we're not doing precaching |
| Background Sync API only | `window.online` event + IndexedDB | 2025 | Background Sync is Chromium-only; online event works on all browsers including iOS Safari |
| `<input capture>` for multi-photo | `getUserMedia` + `<canvas>` stream | Present | For single-photo-per-observation, `<input capture>` is simpler and more reliable across browsers; getUserMedia is the upgrade path |

**Deprecated/outdated:**
- `shadowwalker/next-pwa`: No longer maintained. Not relevant here since Phase 4 doesn't require precaching.
- `navigator.onLine` polling: Replaced by event-driven approach.

---

## Open Questions

1. **Which fields should appear in the observation form beyond `note`?**
   - What we know: FIELD-01 requires text note. The schema supports optional `fieldId` linkage.
   - What's unclear: Does the crew need to select which field the observation is for, or is it always the field they're physically at? Is a severity/type dropdown needed?
   - Recommendation: Start with just `note` + optional photo + optional field selector. Keep the form as simple as possible for v1.0. The schema supports expansion.

2. **Who can view submitted observations?**
   - What we know: CREW submits. ADMIN needs to see them. OFFICE likely also needs to see them.
   - What's unclear: No discussion of observation visibility in CONTEXT.md (which doesn't exist for Phase 4).
   - Recommendation: Default to: CREW submits + sees their own; ADMIN and OFFICE see all observations for the farm.

3. **Should the photo serving route require authentication?**
   - What we know: Photos are stored with UUID filenames (not guessable). The route could be public.
   - What's unclear: Whether the farm cares about unauthenticated photo access.
   - Recommendation: Add `getAuthContext()` guard to the photo serve route, consistent with the rest of the API.

4. **How long to retain observations and photos on the Droplet?**
   - What we know: `uploads/reports/` has no cleanup policy currently.
   - What's unclear: Whether 6 months of observation photos might fill disk.
   - Recommendation: Log this as tech debt. For v1.0, no cleanup policy needed.

---

## Sources

### Primary (HIGH confidence)
- Next.js official PWA docs — https://nextjs.org/docs/app/guides/progressive-web-apps — confirmed: service worker registration pattern, manifest, Serwist recommendation
- MDN Background Synchronization API — https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API — confirmed: Chrome-only, Firefox/Safari not supported
- idb npm package — https://www.npmjs.com/package/idb — confirmed: version 8.0.3 current, full TypeScript types, maintained by Jake Archibald
- Codebase read: `src/app/api/reports/generate/route.ts` — confirmed: `fs.writeFile` to `uploads/reports/` pattern; `path.join(process.cwd(), 'uploads', ...)` is established convention
- Codebase read: `prisma/schema.prisma` — confirmed: `Field` model exists with `farmId`; `User` model exists for `submittedById` FK
- Codebase read: `package.json` — confirmed: `sonner` ^2.0.7, `zod` ^4.3.6, `idb` NOT installed (needs `npm install idb`)

### Secondary (MEDIUM confidence)
- LogRocket "Build a Next.js 16 PWA with true offline support" — https://blog.logrocket.com/nextjs-16-pwa-offline-support/ — verified key pattern: `idb` + `window.online` event; Serwist recommended; fetched and summarized
- Smashing Magazine "Building an Offline-Friendly Image Upload System" (April 2025) — https://smashingmagazine.com/2025/04/building-offline-friendly-image-upload-system/ — verified: IndexedDB blob storage pattern, Background Sync as enhancement only

### Tertiary (LOW confidence — use with verification)
- `createImageBitmap` EXIF auto-rotation claim — sourced from multiple web guides; not verified against MDN spec directly. Test on iOS before assuming it works.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `idb` version verified via npm, disk upload pattern verified via codebase, browser API support verified via MDN
- Architecture: HIGH — mirrors existing patterns in the codebase (uploads dir, auth guard, Prisma model shape)
- Pitfalls: MEDIUM — EXIF handling claim is cross-verified but not tested in this codebase; IndexedDB Private Mode limitation verified via MDN

**Research date:** 2026-03-22
**Valid until:** 2026-06-22 (stable domain — idb, browser APIs, Next.js upload patterns change slowly)
