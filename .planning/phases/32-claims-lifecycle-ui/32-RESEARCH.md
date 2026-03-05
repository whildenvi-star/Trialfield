# Phase 32: Claims Lifecycle UI - Research

**Researched:** 2026-03-05
**Domain:** dnd-kit multi-container Kanban, Supabase Storage file upload UI, slide-over drawer, timeline notes
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Kanban board design:**
- Standard card density: crop, policy reference, deadline badge, claim amount
- 6 insurance-style pipeline stages: Notice of Loss → Filed → Under Review → Adjuster Assigned → Approved/Denied → Settled
- Deadline urgency on cards: color-coded left border (green >30d, amber 7-30d, red <7d, pulsing red overdue) PLUS countdown badge ("14d left")
- Drag-and-drop: instant move on drop, auto-creates timeline entry, then shows skippable note prompt ("Add a note about this change?")
- Overdue claims pinned to top of their stage column with distinct red styling

**Claim detail view:**
- Slide-over drawer from right (consistent with PolicyDrawer from Phase 30)
- Claim header + stage dropdown always visible at top of drawer (stage change from dropdown works same as drag — auto-timeline + optional note)
- 3 tabbed sections below header: Timeline | Documents | Financials
- Financials tab: read-only summary totals — guarantee amount, estimated loss, claim amount, indemnity payment (if any)

**Deadline alerts:**
- Page-level banner at top of Claims page: "2 claims have deadlines within 7 days" — click expands to list
- Also surfaces on portal dashboard summary card (Phase 33 integration point)
- Thresholds: green (>30d), amber (7-30d), red (<7d), pulsing red (overdue)
- Banner is persistent — reappears on every page load as long as approaching deadlines exist (not dismissible)

**Timeline & notes UX:**
- Unified chronological feed mixing system events and user notes (system = gray styling, user notes = accent styling)
- Document uploads auto-create timeline entries ("Document uploaded: filename.ext") with link to Documents tab
- Always-visible inline textarea at bottom of Timeline tab — type + Enter or click "Add Note"
- Append-only notes — no editing or deleting after posting (audit integrity)

### Claude's Discretion

- Exact Kanban card component styling and spacing
- Drawer width and responsive behavior
- Loading states and skeleton patterns
- Empty state design for new claims boards
- Document preview behavior in Documents tab
- Mobile/tablet adaptations for drag-and-drop

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CLM-01 | User can view claims as a Kanban board with pipeline stages | dnd-kit multi-container: one SortableContext per stage column under a single DndContext. Stage columns derived from STAGE_ORDER constant. Claims grouped by `stage` field from GET /api/claims. dynamic({ssr:false}) wraps the Kanban component. |
| CLM-02 | User can drag a claim card to a different stage and the stage change persists (no hydration error on first render) | onDragEnd detects container change (active.data.current.claim.stage vs over column id), calls PATCH /api/claims/[id] with {stage}, uses optimistic update to avoid flicker. dynamic({ssr:false}) prevents hydration mismatch from dnd-kit browser state. |
| CLM-03 | User can open a claim detail view and see full timeline, documents, and financial totals | Slide-over drawer reusing PolicyDrawer pattern (fixed inset-y-0 right-0, translate-x). Three tabs: Timeline (GET /api/claims/[id]/timeline), Documents (GET /api/claims/[id]/documents), Financials (read from claim object). |
| CLM-05 | User can see deadline alert banner when any claim has approaching filing deadline | DeadlineAlertBanner component at top of ClaimsPage. Computes approaching claims from claims array on client. Click-to-expand shows claim list. Color thresholds: >30d green, 7-30d amber, <7d red, overdue pulsing red (Tailwind animate-pulse). |
| CLM-06 | User can add timestamped note to claim timeline without refreshing | Inline textarea at bottom of Timeline tab. POST /api/claims/[id]/timeline with {event_type: 'note', note: text}. Optimistic append: push new entry to local timeline state immediately, then confirm on success. No page refresh needed. |
</phase_requirements>

---

## Summary

Phase 32 is a pure UI phase — all backend APIs from Phase 31 are already built and verified. The phase replaces the existing server-rendered claims table (`page.tsx`) with a client-driven Kanban workspace using the same architectural pattern established in Phase 30 (InsuranceWorkspace): server component fetches initial data, passes it to a `'use client'` workspace component, all mutations go through fetch() against the API routes.

The dominant technical challenge is the Kanban drag-and-drop. dnd-kit is the project's designated library (from v6.0 design context) but is NOT yet installed — it must be added in Plan 32-01 as the first task. The critical correctness concern is hydration safety: `ClaimsKanban` must be wrapped in `dynamic({ ssr: false })` from the start (established decision in STATE.md). This prevents the dnd-kit browser-only state (pointer positions, active draggable) from causing a React hydration mismatch on first render.

The second challenge is the document upload UI in the ClaimDrawer's Documents tab. Phase 31 built the three-step signed URL API (`POST /upload-url` → client PUT → `POST /documents`). Phase 32 must implement the client upload flow using `react-dropzone` (also not yet installed) for drag-and-drop file selection, then call `supabase.storage.from('claim-documents').uploadToSignedUrl()` in the browser client. The 25MB client-side size check should be enforced before calling the upload-url endpoint.

**Primary recommendation:** Install dnd-kit + react-dropzone as the first action in Plan 32-01. Build ClaimsKanban with dynamic import immediately — never retrofit. Follow the InsuranceWorkspace pattern for state management (client-side, no full-page reloads on mutations). The ClaimDrawer slide-over follows the PolicyDrawer pattern exactly.

---

## Standard Stack

### Core (NEW packages — must install)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@dnd-kit/core` | ^6.3.1 | DndContext, DragOverlay, sensors, collision detection | Project-designated DnD library (v6.0 design context); most actively maintained headless DnD for React |
| `@dnd-kit/sortable` | ^10.0.0 | SortableContext, useSortable, arrayMove | Sortable preset for Kanban column ordering and within-column reordering |
| `@dnd-kit/utilities` | ^3.2.2 | CSS.Transform.toString | Required utility for converting dnd-kit transform to CSS string |
| `react-dropzone` | ^14.x | useDropzone hook for file upload UI | Standard React file drop zone; hooks-first API; used in Supabase's own UI docs |

### Already Installed

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `@supabase/supabase-js` | ^2.98.0 | `uploadToSignedUrl` (browser upload), `createSignedUrl` (download) | Storage-js bundled — no extra package needed |
| `next` | 14.2.35 | `dynamic({ ssr: false })` for ClaimsKanban | Already used for react-pdf components |
| `react` | ^18 | Client components, hooks | Project standard |
| `tailwindcss` | ^3.4.1 | Styling, `animate-pulse` for overdue badges | Already configured with soil theme tokens |

### Alternatives Considered

| Instead of | Could Use | Why We Don't |
|------------|-----------|--------------|
| `@dnd-kit/sortable` | `react-beautiful-dnd` | RBD is unmaintained (deprecated 2022); dnd-kit is the designated replacement |
| `@dnd-kit/sortable` | `@hello-pangea/dnd` | Fork of RBD; project already committed to dnd-kit per v6.0 design context |
| `react-dropzone` | Native `<input type="file">` | Dropzone provides drag-drop zone, file rejection state, and type/size filtering without custom event handling |

**Installation:**
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities react-dropzone
```

---

## Architecture Patterns

### Recommended Project Structure

```
glomalin-portal/
├── src/
│   ├── app/
│   │   └── (protected)/app/claims/
│   │       └── page.tsx                  # REPLACE: Server component → fetches claims, renders ClaimsWorkspace
│   ├── components/
│   │   └── claims/
│   │       ├── claims-workspace.tsx      # 'use client' — top-level orchestrator, owns claims state
│   │       ├── claims-kanban.tsx         # 'use client' — DndContext + column layout (SSR-guarded via dynamic)
│   │       ├── claim-column.tsx          # SortableContext per stage + DroppableColumn
│   │       ├── claim-card.tsx            # useSortable — individual claim card
│   │       ├── claim-drawer.tsx          # Slide-over with tabs: Timeline | Documents | Financials
│   │       ├── deadline-alert-banner.tsx # Page-top persistent deadline warning
│   │       ├── timeline-feed.tsx         # Unified system + user note feed
│   │       └── document-upload.tsx       # react-dropzone + three-step signed URL upload
```

### Pattern 1: ClaimsWorkspace (Server → Client handoff)

**What:** Mirrors InsuranceWorkspace — server page fetches initial data, renders the client workspace with `initialClaims`.

**Example:**
```typescript
// src/app/(protected)/app/claims/page.tsx
import { createClient } from '@/lib/supabase/server'
import { ClaimsWorkspace } from '@/components/claims/claims-workspace'

export default async function ClaimsPage() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase
    .from('claims')
    .select('*')
    .order('created_at', { ascending: false })

  return <ClaimsWorkspace initialClaims={claimsData ?? []} />
}
```

```typescript
// src/components/claims/claims-workspace.tsx
'use client'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import { DeadlineAlertBanner } from './deadline-alert-banner'
import { ClaimDrawer } from './claim-drawer'

// SSR guard — dnd-kit uses browser-only APIs
const ClaimsKanban = dynamic(
  () => import('./claims-kanban').then((m) => ({ default: m.ClaimsKanban })),
  { ssr: false, loading: () => <div className="text-soil-muted font-mono text-sm">Loading board...</div> }
)

export function ClaimsWorkspace({ initialClaims }: { initialClaims: Claim[] }) {
  const [claims, setClaims] = useState<Claim[]>(initialClaims)
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const selectedClaim = claims.find(c => c.id === selectedClaimId) ?? null

  async function handleStageChange(claimId: string, newStage: string) {
    // Optimistic update
    setClaims(prev => prev.map(c => c.id === claimId ? { ...c, stage: newStage } : c))
    await fetch(`/api/claims/${claimId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage }),
    })
  }

  return (
    <div className="min-h-screen bg-[#080604] text-[#e8d8c0]">
      <DeadlineAlertBanner claims={claims} />
      <ClaimsKanban
        claims={claims}
        onStageChange={handleStageChange}
        onCardClick={(id) => { setSelectedClaimId(id); setDrawerOpen(true) }}
      />
      <ClaimDrawer
        open={drawerOpen}
        claim={selectedClaim}
        onClose={() => setDrawerOpen(false)}
        onClaimUpdated={(updated) => setClaims(prev => prev.map(c => c.id === updated.id ? updated : c))}
      />
    </div>
  )
}
```

### Pattern 2: dnd-kit Multi-Container Kanban

**What:** One `DndContext` wraps all columns. One `SortableContext` per column. `useSortable` per card. `onDragEnd` detects cross-column moves by comparing `active.data.current.sortable.containerId` vs `over.id` (or `over.data.current.sortable.containerId`).

**Key imports:**
```typescript
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
```

**Stage order constant (source of truth for column order):**
```typescript
// lib/claims/calc.ts — already exists, extend it
export const STAGE_ORDER = [
  'notice_of_loss',
  'filed',
  'under_review',
  'adjuster_assigned',
  'settled',
  'closed',
] as const

export const STAGE_LABELS: Record<string, string> = {
  notice_of_loss: 'Notice of Loss',
  filed: 'Filed',
  under_review: 'Under Review',
  adjuster_assigned: 'Adjuster Assigned',
  settled: 'Settled',
  closed: 'Closed',
}
```

**Note on stage order:** CONTEXT.md lists the user-visible order as "Notice of Loss → Filed → Under Review → Adjuster Assigned → Approved/Denied → Settled". The DB enum has `settled` and `closed` (not `approved/denied`) — display label for `settled` can be "Settled/Approved" and `closed` maps to the final state. Use the 6 DB enum values; the label for `settled` covers the approved outcome.

**ClaimsKanban component:**
```typescript
// src/components/claims/claims-kanban.tsx
'use client'
import { useState } from 'react'
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, closestCorners, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { STAGE_ORDER } from '@/lib/claims/calc'
import { ClaimColumn } from './claim-column'
import { ClaimCard } from './claim-card'

export function ClaimsKanban({ claims, onStageChange, onCardClick }) {
  const [activeClaimId, setActiveClaimId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragStart({ active }: DragStartEvent) {
    setActiveClaimId(active.id as string)
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveClaimId(null)
    if (!over) return

    // The column id is the stage string (e.g., 'filed')
    // Cards use their claim id as the draggable id
    // Detect cross-container: active.data.current.stage vs over.id (column) or over.data.current.stage
    const activeStage = (active.data.current as { stage: string }).stage
    // over could be a column id (dragged over empty column) or another card's id
    const overStage = STAGE_ORDER.includes(over.id as string)
      ? (over.id as string)
      : (over.data.current as { stage: string } | undefined)?.stage

    if (!overStage || activeStage === overStage) return

    onStageChange(active.id as string, overStage)
  }

  const activeClaim = claims.find(c => c.id === activeClaimId)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGE_ORDER.map(stage => (
          <ClaimColumn
            key={stage}
            stage={stage}
            claims={claims.filter(c => c.stage === stage)}
            onCardClick={onCardClick}
          />
        ))}
      </div>
      <DragOverlay>
        {activeClaim ? <ClaimCard claim={activeClaim} isDragOverlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}
```

**ClaimCard with useSortable:**
```typescript
// src/components/claims/claim-card.tsx
'use client'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export function ClaimCard({ claim, onCardClick, isDragOverlay = false }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: claim.id,
    data: { stage: claim.stage, claim },  // pass stage for cross-container detection
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onCardClick?.(claim.id)}
      className={`rounded border bg-[#0e0c0b] cursor-grab active:cursor-grabbing
        ${getDeadlineBorderClass(claim.deadline_at, claim.stage)}`}
    >
      {/* Card content: crop, policy ref, deadline badge, claim amount */}
    </div>
  )
}
```

**ClaimColumn with SortableContext:**
```typescript
// src/components/claims/claim-column.tsx
'use client'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'

export function ClaimColumn({ stage, claims, onCardClick }) {
  const { setNodeRef } = useDroppable({ id: stage })

  return (
    <div className="flex-none w-64 flex flex-col">
      <h3 className="text-xs font-mono uppercase text-[#6a5a4a] mb-2">{STAGE_LABELS[stage]}</h3>
      <SortableContext items={claims.map(c => c.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex-1 flex flex-col gap-2 min-h-[100px]">
          {/* Overdue claims pinned to top */}
          {claims.filter(isOverdue).map(c => <ClaimCard key={c.id} claim={c} onCardClick={onCardClick} />)}
          {claims.filter(c => !isOverdue(c)).map(c => <ClaimCard key={c.id} claim={c} onCardClick={onCardClick} />)}
        </div>
      </SortableContext>
    </div>
  )
}
```

### Pattern 3: Deadline Color Logic (client-side, no library needed)

```typescript
// lib/claims/calc.ts — extend existing file
export function getDeadlineDaysRemaining(deadlineAt: string | null, stage: string): number | null {
  if (!deadlineAt || stage === 'closed') return null
  const now = new Date()
  const deadline = new Date(deadlineAt)
  return Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function getDeadlineBorderClass(deadlineAt: string | null, stage: string): string {
  const days = getDeadlineDaysRemaining(deadlineAt, stage)
  if (days === null) return 'border-[#2a2218]'
  if (days < 0) return 'border-l-4 border-l-red-600 animate-pulse border-[#2a2218]'
  if (days < 7) return 'border-l-4 border-l-red-500 border-[#2a2218]'
  if (days <= 30) return 'border-l-4 border-l-amber-500 border-[#2a2218]'
  return 'border-l-4 border-l-[#7A9E7E] border-[#2a2218]'
}

export function getDeadlineCountdown(deadlineAt: string | null, stage: string): string | null {
  const days = getDeadlineDaysRemaining(deadlineAt, stage)
  if (days === null) return null
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Due today'
  return `${days}d left`
}

export function isOverdue(claim: { deadline_at: string | null; stage: string }): boolean {
  const days = getDeadlineDaysRemaining(claim.deadline_at, claim.stage)
  return days !== null && days < 0
}
```

### Pattern 4: ClaimDrawer (slide-over, tabs)

**What:** Mirrors PolicyDrawer — `fixed inset-y-0 right-0 z-50`, `translate-x-full` when closed, `translate-x-0` when open. Three tabbed sections: Timeline, Documents, Financials.

```typescript
// src/components/claims/claim-drawer.tsx
'use client'
import { useState, useEffect } from 'react'

type DrawerTab = 'timeline' | 'documents' | 'financials'

export function ClaimDrawer({ open, claim, onClose, onClaimUpdated }) {
  const [activeTab, setActiveTab] = useState<DrawerTab>('timeline')
  const [timeline, setTimeline] = useState([])
  const [documents, setDocuments] = useState([])

  useEffect(() => {
    if (open && claim) {
      // Fetch timeline and documents in parallel
      Promise.all([
        fetch(`/api/claims/${claim.id}/timeline`).then(r => r.json()),
        fetch(`/api/claims/${claim.id}/documents`).then(r => r.json()),
      ]).then(([tl, docs]) => {
        setTimeline(tl.events ?? [])
        setDocuments(docs.documents ?? [])
      })
    }
  }, [open, claim?.id])

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden />}
      <div className={`fixed inset-y-0 right-0 z-50 w-[520px] bg-[#0e0c0b] border-l border-[#2a2218] flex flex-col transition-transform duration-200 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header: crop, stage dropdown, close */}
        {/* Tabs: Timeline | Documents | Financials */}
        {/* Tab content */}
      </div>
    </>
  )
}
```

**Stage dropdown in drawer header** triggers same PATCH flow as drag-and-drop:
```typescript
async function handleStageChange(newStage: string) {
  const res = await fetch(`/api/claims/${claim.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage: newStage }),
  })
  const { claim: updated } = await res.json()
  onClaimUpdated(updated)
  // Append optimistic timeline entry for stage change
  setTimeline(prev => [...prev, { event_type: 'stage_change', event_data: { from_stage: claim.stage, to_stage: newStage }, created_at: new Date().toISOString() }])
}
```

### Pattern 5: Timeline Feed (append-only notes)

```typescript
// POST /api/claims/[id]/timeline (already built in Phase 31)
// Body: { event_type: 'note', note: string }

async function handleAddNote(text: string) {
  // Optimistic append
  const optimistic = { event_type: 'note', note: text, created_at: new Date().toISOString() }
  setTimeline(prev => [...prev, optimistic])

  const res = await fetch(`/api/claims/${claim.id}/timeline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_type: 'note', note: text }),
  })
  // On success, replace optimistic entry with server-returned entry (for id + actor_id)
  const { event } = await res.json()
  setTimeline(prev => [...prev.slice(0, -1), event])
}
```

**Timeline entry styling:**
```typescript
// System events (stage_change, doc_upload, etc.) → gray text, small icon
// User notes → accent (#C8860A) left border, user attribution
function TimelineEntry({ event }) {
  const isNote = event.event_type === 'note'
  return (
    <div className={`py-2 text-xs font-mono ${isNote ? 'border-l-2 border-l-[#C8860A] pl-3' : 'text-[#6a5a4a] pl-1'}`}>
      <span>{formatTimelineEvent(event)}</span>
      <span className="ml-2 text-[#6a5a4a]">{formatDate(event.created_at)}</span>
    </div>
  )
}
```

### Pattern 6: Document Upload (react-dropzone + three-step signed URL)

**What:** `useDropzone` for file selection UI. Three-step upload: POST /upload-url → `uploadToSignedUrl` → POST /documents. Client-side 25MB cap before calling server (Phase 31 decision: Storage enforces 50MB, UI enforces 25MB for UX).

```typescript
// src/components/claims/document-upload.tsx
'use client'
import { useDropzone } from 'react-dropzone'
import { useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/browser'

const MAX_SIZE_BYTES = 25 * 1024 * 1024  // 25MB — matches Phase 31-02 decision
const ALLOWED_TYPES = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'text/csv': ['.csv'],
}

export function DocumentUpload({ claimId, onUploadComplete }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return
    const file = acceptedFiles[0]

    // Client-side size check (UX guard — Storage enforces 50MB hard limit)
    if (file.size > MAX_SIZE_BYTES) {
      setError(`File too large. Maximum size is 25MB.`)
      return
    }

    setUploading(true)
    setError(null)
    try {
      // Step 1: Get signed upload URL from server
      const urlRes = await fetch(`/api/claims/${claimId}/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, mimeType: file.type }),
      })
      const { path, token, error: urlError } = await urlRes.json()
      if (urlError) throw new Error(urlError)

      // Step 2: Upload directly to Storage (no server bytes)
      const { error: uploadError } = await supabase.storage
        .from('claim-documents')
        .uploadToSignedUrl(path, token, file, { contentType: file.type })
      if (uploadError) throw uploadError

      // Step 3: Save metadata
      await fetch(`/api/claims/${claimId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, filename: file.name, fileSize: file.size, mimeType: file.type }),
      })

      onUploadComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [claimId, supabase])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ALLOWED_TYPES,
    maxSize: MAX_SIZE_BYTES,
    maxFiles: 1,
  })

  return (
    <div
      {...getRootProps()}
      className={`border border-dashed rounded p-4 text-center cursor-pointer font-mono text-sm transition-colors
        ${isDragActive ? 'border-[#C8860A] bg-[#C8860A]/5' : 'border-[#2a2218] hover:border-[#6a5a4a]'}`}
    >
      <input {...getInputProps()} />
      {uploading ? (
        <span className="text-[#6a5a4a]">Uploading...</span>
      ) : isDragActive ? (
        <span className="text-[#C8860A]">Drop file here</span>
      ) : (
        <span className="text-[#6a5a4a]">Drop a file here or click to select (PDF, JPG, PNG, XLSX, CSV — max 25MB)</span>
      )}
      {error && <p className="mt-2 text-red-400 text-xs">{error}</p>}
    </div>
  )
}
```

**CRITICAL:** The signed upload token is single-use. If the `uploadToSignedUrl` call fails, the UI must call `/upload-url` again to get a fresh token before retrying. Do not reuse the token.

### Pattern 7: DeadlineAlertBanner

```typescript
// src/components/claims/deadline-alert-banner.tsx
'use client'
import { useState } from 'react'
import { getDeadlineDaysRemaining } from '@/lib/claims/calc'

export function DeadlineAlertBanner({ claims }) {
  const [expanded, setExpanded] = useState(false)

  const approaching = claims.filter(c => {
    const days = getDeadlineDaysRemaining(c.deadline_at, c.stage)
    return days !== null && days <= 7
  })

  if (approaching.length === 0) return null

  const hasOverdue = approaching.some(c => {
    const d = getDeadlineDaysRemaining(c.deadline_at, c.stage)
    return d !== null && d < 0
  })

  return (
    <div className={`mb-6 rounded border px-4 py-3 font-mono text-sm
      ${hasOverdue ? 'border-red-600 bg-red-900/10 text-red-400 animate-pulse' : 'border-amber-600 bg-amber-900/10 text-amber-400'}`}
    >
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left flex items-center justify-between">
        <span>
          {approaching.length} claim{approaching.length > 1 ? 's' : ''} {hasOverdue ? 'overdue or' : 'have deadlines'} within 7 days
        </span>
        <span>{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <ul className="mt-2 space-y-1 text-xs">
          {approaching.map(c => (
            <li key={c.id}>
              {c.crop ?? '—'} · Deadline: {formatDate(c.deadline_at)} ({getDeadlineCountdown(c.deadline_at, c.stage)})
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

### Anti-Patterns to Avoid

- **No dynamic({ssr:false}) on ClaimsKanban:** dnd-kit uses `window` and pointer events. Without SSR guard, Next.js will produce a hydration mismatch. This is a hard architectural rule (STATE.md v6.0 decision).
- **Routing file bytes through fetch/Server Actions for upload:** Next.js Server Actions have a 1MB body limit. Always use the three-step signed URL pattern. Phase 31 implemented the server endpoints; Phase 32 only adds the client-side upload UI.
- **Reusing a signed upload token after failure:** Supabase signed upload tokens are single-use. On retry, always fetch a fresh token from `/upload-url`.
- **Full-page reload on PATCH:** Mutations must update local `claims` state directly (optimistic) so the Kanban board reflects the change without remounting. Follow InsuranceWorkspace pattern.
- **DragOverlay missing:** Without DragOverlay, the original card disappears during drag without visual feedback. DragOverlay renders a floating clone during the drag gesture.
- **SortableContext items mismatch:** The `items` prop to SortableContext must match the rendered claim IDs in order. If overdue claims are pinned to top, sort the `items` array to match that visual order (overdue first, then non-overdue).
- **Forgetting to pass `data` to useSortable:** The `onDragEnd` handler needs the source stage to detect cross-column moves. Pass `data: { stage: claim.stage }` to `useSortable({ id, data })`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop between columns | Custom mouse/pointer event handlers | `@dnd-kit/core` + `@dnd-kit/sortable` | Touch support, accessibility (keyboard), scroll-during-drag, DragOverlay — all handled |
| File drop zone UI | Native drag events on a div | `react-dropzone` `useDropzone` | File type filtering, multiple-file rejection, drag-active state, accessible fallback click |
| Transform-to-CSS conversion | Manual `translate3d` string construction | `CSS.Transform.toString(transform)` from `@dnd-kit/utilities` | dnd-kit's transform object is not directly a CSS string; the utility handles null transforms safely |
| Deadline urgency calculations | Ad-hoc inline Date math | `getDeadlineDaysRemaining()` in `lib/claims/calc.ts` | Centralizes the logic; reused by both ClaimCard border and DeadlineAlertBanner; testable |
| Slide-over drawer | Portal/modal library | CSS transform pattern from PolicyDrawer | Pattern already exists and is consistent with Phase 30 — no new library needed |

**Key insight:** The dnd-kit/react-dropzone combo covers all complex UI interactions. Everything else (deadline logic, drawer, timeline, financials) is plain React + Tailwind — no additional libraries needed.

---

## Common Pitfalls

### Pitfall 1: Hydration Error from dnd-kit Without SSR Guard

**What goes wrong:** Server renders the Kanban HTML with no drag state. Browser hydrates and dnd-kit immediately sets up pointer listeners, creating a state mismatch React detects and throws.

**Why it happens:** dnd-kit hooks call `window` and `document` APIs during initialization. These don't exist during server rendering.

**How to avoid:** Wrap `ClaimsKanban` in `dynamic({ ssr: false })` from the very first commit. Do not add it later as a fix — retrofitting causes a brief layout shift. The `ClaimsWorkspace` parent handles the dynamic import; `ClaimsKanban` is a plain `'use client'` export.

**Warning signs:** `Error: Hydration failed because the server-rendered HTML didn't match the client.` in the browser console on the claims page.

### Pitfall 2: Cross-Container Detection in onDragEnd

**What goes wrong:** `over.id` is sometimes the ID of a card (when dropping onto another card), not the column/stage ID. The stage change logic breaks when over refers to a card not a column.

**Why it happens:** dnd-kit's `over` in `onDragEnd` refers to whichever droppable the pointer was last over — either a `useDroppable` column or a `useSortable` card. Cards are both draggable AND droppable.

**How to avoid:** Check whether `over.id` is a stage string (using `STAGE_ORDER.includes(over.id)`) to know if it's a column drop. Otherwise, read `over.data.current.stage` (the stage passed to `useSortable`'s `data` option) to get the target column.

**Warning signs:** Stage changes work when dropping on the column header but not when dropping onto an existing card.

### Pitfall 3: SortableContext Items Not Matching Rendered Order

**What goes wrong:** Sorting within a column jumps cards to wrong positions or dnd-kit logs "The items array is not sorted in the same order as the components."

**Why it happens:** The `items` prop to `SortableContext` must be in the same order as the rendered card elements. If overdue claims are pinned to the top, the `items` array must also have overdue claim IDs first.

**How to avoid:** Build the displayed claims array (overdue pinned first) before passing both to `SortableContext items` and mapping for rendering. Use the same array for both.

### Pitfall 4: Signed Token Reuse After Upload Failure

**What goes wrong:** User uploads a file, it fails (network error). Retry re-uses the same `token`. Supabase returns 400 because the token was already consumed.

**Why it happens:** Supabase signed upload tokens are single-use. The token is invalidated after the first PUT attempt regardless of success.

**How to avoid:** In `DocumentUpload`, the `onDrop` handler must always start with a fresh call to `/upload-url`. Never cache the token in component state for reuse. The retry path should call `onDrop` again (or restart the three-step flow from step 1).

### Pitfall 5: Optimistic Update Not Reverting on PATCH Failure

**What goes wrong:** User drags a card to a new column. UI moves the card (optimistic). The PATCH fails. The card stays in the wrong column until the user refreshes.

**Why it happens:** The optimistic update sets state immediately, but the async PATCH failure is ignored.

**How to avoid:** In `handleStageChange`, capture the previous state before the optimistic update and revert if the PATCH returns non-2xx:

```typescript
async function handleStageChange(claimId: string, newStage: string) {
  const previousClaims = claims  // capture before update
  setClaims(prev => prev.map(c => c.id === claimId ? { ...c, stage: newStage } : c))
  const res = await fetch(`/api/claims/${claimId}`, { method: 'PATCH', ... })
  if (!res.ok) {
    setClaims(previousClaims)  // revert
  }
}
```

### Pitfall 6: Note Prompt UX After Drag

**What goes wrong:** Stage change from drag triggers a blocking modal asking for a note. User wants to keep dragging. UX becomes painful.

**Why it happens:** Design requires the note prompt to be skippable (CONTEXT.md: "then shows skippable note prompt — Add a note about this change?").

**How to avoid:** Use an inline toast-style prompt that appears near the moved card (or at the bottom of the column). Not a full modal with backdrop. Auto-dismiss after 10 seconds if not interacted with. The prompt posts `POST /api/claims/[id]/timeline { event_type: 'note' }` only if the user types and submits.

---

## Code Examples

Verified patterns from official sources and project codebase:

### dnd-kit: Minimal multi-container onDragEnd with stage detection
```typescript
// Source: dnd-kit official docs (SortableContext + DndContext patterns) + WebSearch verified
function handleDragEnd({ active, over }: DragEndEvent) {
  if (!over) return
  const sourceStage = (active.data.current as { stage: string }).stage
  const targetStage = STAGE_ORDER.includes(over.id as string)
    ? (over.id as string)
    : (over.data.current as { stage?: string } | undefined)?.stage
  if (!targetStage || sourceStage === targetStage) return
  onStageChange(active.id as string, targetStage)
}
```

### react-dropzone: minimal useDropzone with accept + maxSize
```typescript
// Source: react-dropzone official docs (react-dropzone.js.org)
const { getRootProps, getInputProps, isDragActive } = useDropzone({
  onDrop,
  accept: { 'application/pdf': ['.pdf'], 'image/jpeg': ['.jpg', '.jpeg'] },
  maxSize: 25 * 1024 * 1024,
  maxFiles: 1,
})
```

### PolicyDrawer slide-over pattern (Phase 30 — verified in codebase)
```typescript
// Source: glomalin-portal/src/components/insurance/policy-drawer.tsx
<div className={`fixed inset-y-0 right-0 z-50 w-[480px] bg-soil-surface border-l border-soil-border flex flex-col transition-transform duration-200
  ${open ? 'translate-x-0' : 'translate-x-full'}`}>
```

### dynamic() with named export (Phase 28 established pattern — STATE.md)
```typescript
// Source: STATE.md [Phase 28-02] decision log
const ClaimsKanban = dynamic(
  () => import('./claims-kanban').then((m) => ({ default: m.ClaimsKanban })),
  { ssr: false }
)
```

### Timeline POST to existing API (Phase 31 verified)
```typescript
// Source: glomalin-portal/src/app/api/claims/[id]/timeline/route.ts (Phase 31)
await fetch(`/api/claims/${claimId}/timeline`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ event_type: 'note', note: noteText }),
})
```

### PATCH /api/claims/[id] for stage change (Phase 31 verified)
```typescript
// Source: glomalin-portal/src/app/api/claims/[id]/route.ts (Phase 31)
// PATCH accepts: stage, deadline_at, deadline_overridden, date_of_loss, cause_of_loss,
//                description, estimated_loss_bu, appraised_value, indemnity_amount,
//                deductible_amount, adjuster_name, adjuster_phone, notes, clu_record_id
await fetch(`/api/claims/${claimId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ stage: newStage }),
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-beautiful-dnd` | `@dnd-kit/core` + `@dnd-kit/sortable` | 2022 (RBD deprecated) | dnd-kit is headless, composable, TypeScript-first; RBD is no longer maintained |
| `html` drag events with `onDragOver` | `@dnd-kit` with PointerSensor | 2022+ | dnd-kit handles touch devices, multi-pointer, accessibility keyboard nav natively |
| `params.id` as sync value | `await params` (Next.js 15+ Promise params) | Next.js 15 (2024) | Project already uses this pattern — all API route handlers in Phase 31 use `await params` |
| Server-side file routing | Signed URL three-step pattern | Supabase Storage v2 (2023) | Phase 31 built the API; Phase 32 UI completes the flow |

**Deprecated/outdated:**
- `react-beautiful-dnd`: deprecated 2022, no longer maintained. Do not use. @dnd-kit is the community successor.
- `next/dynamic` with `{ ssr: false }` on the page level: prefer wrapping only the DnD component, not the whole page, to preserve server-rendering of the rest of the claims page.

---

## Open Questions

1. **Stage order vs DB enum order**
   - What we know: DB enum is `notice_of_loss, filed, adjuster_assigned, under_review, settled, closed`. CONTEXT.md user decision lists visual order as `Notice of Loss → Filed → Under Review → Adjuster Assigned → Approved/Denied → Settled`.
   - What's unclear: CONTEXT.md lists "Under Review" before "Adjuster Assigned" (different from DB enum order). Also lists "Approved/Denied" as a stage name, but DB has `settled` not `approved_denied`.
   - Recommendation: Use the CONTEXT.md visual order for column layout (`STAGE_ORDER` constant). Map `settled` to display label "Settled / Approved". Keep `closed` as the terminal column. The DB enum order does not constrain the visual column order.

2. **Note prompt after drag (implementation specifics)**
   - What we know: CONTEXT.md says "toast/inline prompt, not a blocking modal." The prompt is skippable.
   - What's unclear: Where exactly to render the prompt (at the moved card, at the bottom of the page, as a floating element). Implementation left to Claude's discretion.
   - Recommendation: Render as a small floating prompt that appears bottom-right of the viewport (similar to a notification) with a 10-second auto-dismiss. `useState<string | null>(pendingNoteForClaimId)` in ClaimsWorkspace drives visibility.

3. **react-dropzone version**
   - What we know: npm registry shows react-dropzone at v14.x as of 2025. Peer deps require React 16.8+.
   - What's unclear: Exact latest version not verified (npm page returned 403 during research).
   - Recommendation: Install with `npm install react-dropzone` (no version pin) — npm will install latest stable. The `useDropzone` hook API has been stable since v11.

---

## Validation Architecture

> Skipped — `workflow.nyquist_validation` not present in `.planning/config.json`. Nyquist validation is not enabled for this project.

---

## Sources

### Primary (HIGH confidence)
- Project codebase: `glomalin-portal/src/components/insurance/policy-drawer.tsx` — slide-over drawer pattern
- Project codebase: `glomalin-portal/src/components/insurance/insurance-workspace.tsx` — server→client data handoff + dynamic() pattern
- Project codebase: `glomalin-portal/src/app/api/claims/route.ts` — GET and POST claim API (Phase 31)
- Project codebase: `glomalin-portal/src/app/api/claims/[id]/route.ts` — PATCH API with full ClaimPatch interface (Phase 31)
- Project codebase: `glomalin-portal/src/app/api/claims/[id]/documents/route.ts` — document list + signed download URLs
- Project codebase: `.planning/phases/31-claims-tables-api/31-RESEARCH.md` — signed URL patterns, schema decisions
- Project codebase: `.planning/phases/31-claims-tables-api/31-02-SUMMARY.md` — confirmed three-step upload pattern, 25MB UX limit decision
- dnd-kit official docs (SortableContext): https://dndkit.com/presets/sortable/sortable-context — items prop, strategy options
- dnd-kit official docs (useSortable): https://dndkit.com/presets/sortable/use-sortable — attributes, listeners, setNodeRef, transform, CSS.Transform
- react-dropzone official: https://react-dropzone.js.org — useDropzone hook, onDrop signature, accept prop format

### Secondary (MEDIUM confidence)
- WebSearch: dnd-kit multi-container Kanban patterns (multiple community sources agree on DndContext + SortableContext per column + useDroppable on column approach)
- WebSearch: `@dnd-kit/core` v6.3.1, `@dnd-kit/sortable` v10.0.0, `@dnd-kit/utilities` v3.2.2 (npm registry data via Cloudsmith)
- Supabase UI docs: https://supabase.com/ui/docs/nextjs/dropzone — confirms react-dropzone is standard pattern for Supabase Storage uploads

### Tertiary (LOW confidence)
- Chetanverma.com Kanban tutorial: specific useSortable data shape patterns — architecture matches docs but this is a third-party tutorial
- react-dropzone exact version: npm page returned 403; version confirmed as "14.x" from WebSearch but not verified against registry directly

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — dnd-kit is the project-designated library; react-dropzone is well-established; all other libraries already in project
- Architecture: HIGH — follows established InsuranceWorkspace + PolicyDrawer patterns exactly; Phase 31 APIs verified in codebase
- dnd-kit multi-container pattern: MEDIUM — core DndContext/SortableContext API verified via official docs; cross-container detection logic is community-pattern verified but not against a specific official example
- Document upload UI: HIGH — three-step signed URL pattern verified in Phase 31 codebase; react-dropzone hook API stable
- Package versions: MEDIUM — dnd-kit versions from Cloudsmith/WebSearch (npm registry 403); recommend `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities` without pinned versions

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 — dnd-kit and react-dropzone APIs are stable; Next.js 14 App Router is stable
