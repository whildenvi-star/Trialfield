# Roadmap: Glomalin Portal Mobile PWA

## Overview

The portal already has PWA scaffolding, offline caching, and Supabase auth in place — it just doesn't work on a phone. This roadmap delivers genuine mobile usability in four phases: first a navigable mobile shell with touch-friendly controls, then hardened offline sync with visible status, then a mobile-optimized dashboard that surfaces key operations data, and finally field observation submission so crew can push notes from the field back to the office. Every phase delivers something a farm team member can actually use.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Mobile Shell** - Navigable, touch-friendly mobile layout foundation
- [ ] **Phase 2: Offline Sync** - Hardened offline layer with visible sync status
- [ ] **Phase 3: Mobile Dashboard** - Phone-optimized dashboard with module-aware data
- [ ] **Phase 4: Field Data Entry** - Field observation submission with offline queue

## Phase Details

### Phase 1: Mobile Shell
**Goal**: Farm team members can open the portal on a phone and navigate between modules without layout breakage or unusably small touch targets
**Depends on**: Nothing (first phase)
**Requirements**: UX-01, UX-02
**Success Criteria** (what must be TRUE):
  1. User can tap any navigation item from their phone without mis-tapping adjacent items (44px+ targets)
  2. User can navigate between all native module pages using a bottom nav or equivalent mobile-first pattern
  3. All native module pages render in a single-column layout without horizontal scrolling on a 375px viewport
  4. Embedded iframe modules (FSA 578, Insurance, Claims, Macro Rollup) show a graceful fallback on mobile rather than a broken iframe
**Plans**: TBD

### Phase 2: Offline Sync
**Goal**: Users can see whether they are online or offline and trust that any actions taken offline will sync when connectivity returns
**Depends on**: Phase 1
**Requirements**: SYNC-01, SYNC-02
**Success Criteria** (what must be TRUE):
  1. User sees a clear online/offline status indicator that updates when connectivity changes
  2. User sees a count of items queued but not yet synced to the server
  3. Queued items drain automatically when connectivity is restored without user action
  4. Sync does not silently overwrite data — conflicts surface visibly rather than failing silently
**Plans**: TBD

### Phase 3: Mobile Dashboard
**Goal**: Farm team members open the portal and immediately see the data most relevant to their work, filtered to the modules they can access, in a layout designed for a phone screen
**Depends on**: Phase 2
**Requirements**: DASH-01, DASH-02, DASH-03
**Success Criteria** (what must be TRUE):
  1. User sees a dashboard page on their phone with data cards from their accessible modules
  2. User only sees module cards for modules their account has access to
  3. User can tap a quick-action on a dashboard card (e.g., mark task done) without navigating away
**Plans**: TBD

### Phase 4: Field Data Entry
**Goal**: Farm crew can submit field observations from their phones in the field, including photos, and those submissions reach the office even when connectivity is spotty
**Depends on**: Phase 3
**Requirements**: FIELD-01, FIELD-02, FIELD-03
**Success Criteria** (what must be TRUE):
  1. User can submit a field observation with a text note from their phone
  2. User can attach a photo to a field observation before submitting
  3. Observations submitted while offline queue locally and sync automatically when connectivity returns
  4. User receives confirmation when a queued observation successfully syncs
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Mobile Shell | 0/TBD | Not started | - |
| 2. Offline Sync | 0/TBD | Not started | - |
| 3. Mobile Dashboard | 0/TBD | Not started | - |
| 4. Field Data Entry | 0/TBD | Not started | - |
