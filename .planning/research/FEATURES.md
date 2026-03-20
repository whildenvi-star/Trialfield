# Feature Research

**Domain:** Mobile PWA farm operations — internal team tool for small farm crew (2-5 people)
**Researched:** 2026-03-20
**Confidence:** MEDIUM — based on competitor analysis, PWA best practices docs (MDN, industry sources), and agriculture app market research. Specific to a small-team internal tool, not a commercial product.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features field workers assume exist. Missing these = tool gets abandoned for paper or text messages.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Mobile-responsive layouts for all module pages | Workers access from phones in the field; broken desktop layouts make the tool unusable | MEDIUM | All existing modules (FSA 578, Insurance, Claims, Macro Rollup) need responsive treatment; embedded iframe modules require special handling |
| Touch-friendly forms for data entry | Fingers, gloves, field conditions — small tap targets are painful and cause errors | MEDIUM | Large tap targets (min 44px), clear labels, minimal required fields, avoid multi-column layouts on mobile |
| Offline read access to critical data | Rural farms have spotty cellular; data must be readable without signal | MEDIUM | IndexedDB caching already exists for crop plans — needs extension to cover dashboard + key module data |
| Offline write queue with sync-on-reconnect | Field observations entered without signal must not be lost | HIGH | Operation queue pattern already in place (`src/lib/offline/`) — extend to new field data entry forms |
| Persistent login / session on mobile | Re-logging in every field visit kills adoption; sessions must survive app close | LOW | Supabase cookie-based auth already handles this; verify PWA session persistence after install |
| PWA install prompt / installability | Field workers need a home screen icon — "go to website" is a barrier to daily use | LOW | Manifest already exists; improve beforeinstallprompt UX and fallback instructions for iOS |
| Visible sync status indicator | Workers need to know when they're offline and whether their data submitted | LOW | Simple online/offline banner + pending queue count badge — critical trust signal |
| Quick-access home screen dashboard | Workers open the app dozens of times a day; they need their most-used info immediately | MEDIUM | Single-screen view of most critical module data and pending tasks; no deep navigation required |
| Basic push notifications for time-sensitive alerts | Field teams need to know when critical data changes (insurance deadline, claim status) | MEDIUM | Web Push API via service worker; requires Supabase edge function or webhook trigger; iOS requires PWA install |

### Differentiators (Competitive Advantage)

Features that make this portal a genuinely better tool for the W. Hughes Farms crew vs. generic farm apps.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Module-aware mobile dashboard | Dashboard shows only the modules this user has access to, surfacing relevant data at a glance — no hunting | LOW | Module access control already exists; dashboard can render access-filtered cards |
| Field observation submission from phone | Crew can push notes, photos, and status updates from anywhere; office sees it immediately | MEDIUM | New form UI + API route + offline queue entry; photo support adds complexity (file upload queue) |
| Optimistic UI updates with offline feedback | Form submit feels instant even offline; crew gets clear confirmation vs. silent failure | MEDIUM | Show pending state, queue confirmation toast, sync indicator — follows existing backoff retry pattern |
| One-tap actions for common workflows | Frequently used actions (submit note, mark task done) accessible without 3+ taps | LOW | Progressive disclosure: surface common actions on dashboard cards rather than requiring navigation into module |
| Text-scale and high-contrast mode | Field conditions: bright sunlight, dirty screens, gloves — accessibility settings that work outdoors | LOW | LocalStorage text-scale preference already exists; extend to contrast ratio setting (7:1 target for direct sunlight) |
| Lightweight offline-first crop plan view | Crop plan data already cached offline — surface it as the primary offline dashboard content | LOW | Extend existing `crop-plan-sync.ts` to populate a mobile-friendly read view |

### Anti-Features (Commonly Requested, Often Problematic)

Features to deliberately not build for this context.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time collaborative editing | Sounds modern and useful | Two crew members editing the same record simultaneously creates merge conflicts; server-wins or client-wins both cause data loss; CRDT complexity is months of work | Optimistic single-writer with conflict detection on sync — last-write-wins with timestamp is sufficient for a 2-5 person team |
| Native iOS / Android app | App store presence feels professional | Enormous overhead: two codebases, store review cycles, device testing, MDM enrollment; contradicts the project constraint of no new infrastructure | PWA covers all requirements for a small internal team; install prompt is sufficient |
| Rich analytics / reporting on mobile | Managers want data anywhere | Farm analytics require large tables, charts, and complex filtering — these are desktop workflows and kill mobile performance | Surface key KPI numbers on mobile dashboard; link to full desktop view for deep analysis |
| Chat / messaging within the app | Team coordination feels essential | Duplicates existing communication tools (SMS, messaging apps) the team already uses; in-app chat requires real-time infra (WebSockets) and is high maintenance | Push notifications for critical alerts + field observations as structured notes are sufficient |
| Automatic background data refresh | Always-fresh data sounds better | Periodic Background Sync API has limited browser support (Chrome only, no iOS Safari); silent failures confuse users | Pull-to-refresh + sync-on-foreground pattern is reliable and explicit; user controls when data refreshes |
| Full module feature parity on mobile | Complete feature access from phone | Embedded iframe modules (Express apps) cannot be reliably made mobile-friendly without rebuilding them; scope creep risk | Mobile exposes read + quick-add for native modules; links to desktop for embedded module workflows |
| GPS / location tagging on all records | Field data with location metadata sounds valuable | Geolocation API on mobile requires permission prompts, drains battery, and adds latency to form submission; low ROI for a 2-5 person team on a known property | Optional location field (manual text input: "North field, row 4") is simpler and sufficient |

---

## Feature Dependencies

```
[PWA Install Prompt]
    └──enables──> [Push Notifications on iOS]

[Offline Write Queue]
    └──requires──> [Sync Status Indicator]
    └──requires──> [Sync-on-Reconnect Logic]
                       └──requires──> [Conflict Resolution Strategy]

[Field Observation Submission]
    └──requires──> [Touch-Friendly Forms]
    └──requires──> [Offline Write Queue]

[Module-Aware Dashboard]
    └──requires──> [Mobile-Responsive Layouts]
    └──requires──> [Module Access Control] (already exists)

[Push Notifications]
    └──requires──> [PWA Install] (for iOS support)
    └──requires──> [Service Worker] (already exists)
    └──requires──> [Notification Trigger] (Supabase webhook or edge function)

[Offline Read Access]
    └──enhances──> [Module-Aware Dashboard]

[Text-Scale / High-Contrast Mode]
    └──enhances──> [Touch-Friendly Forms]
    └──enhances──> [Module-Aware Dashboard]
```

### Dependency Notes

- **Push Notifications require PWA Install on iOS:** iOS Safari only supports Web Push for installed PWAs (added in iOS 16.4). Users must install to homescreen before notifications work. Build the install prompt before notification opt-in.
- **Offline Write Queue requires Sync Status Indicator:** Without visible sync state, users submit forms twice thinking the first failed — causing duplicate records. These must ship together.
- **Field Observation Submission requires Offline Write Queue:** A field data form that silently drops submissions when offline is worse than paper. Queue comes first.
- **Module-Aware Dashboard requires responsive layouts:** Rendering module data on mobile without responsive layout foundations causes horizontal scroll and broken UI. Responsive treatment is the prerequisite.

---

## MVP Definition

### Launch With (v1) — Mobile-Usable Core

Minimum needed for a field crew to prefer this over paper or texts.

- [ ] Mobile-responsive layouts for all native module pages (FSA 578, Insurance, Claims, Macro Rollup) — without this, the portal is functionally unusable on phones
- [ ] Touch-friendly form controls (tap target sizing, single-column layout, clear labels) — applies to any existing forms + new field observation forms
- [ ] Sync status indicator (online/offline banner + pending queue count) — trust signal, required with any offline write capability
- [ ] Offline read access for dashboard + crop plan data — extend existing IndexedDB caching to cover quick-glance data
- [ ] PWA install prompt improvement — better UX for Android (beforeinstallprompt) + manual instructions for iOS; home screen icon is table stakes

### Add After Validation (v1.x) — Field Data Push

Add once crew is using the portal daily from mobile.

- [ ] Field observation submission form (text note + optional photo) with offline queue — trigger: crew reporting they're still texting observations instead of using the portal
- [ ] Optimistic UI + submission confirmation toasts — trigger: crew complaining about uncertainty after form submit
- [ ] One-tap quick actions on dashboard cards — trigger: crew feedback that navigation is too deep
- [ ] Push notifications for deadline alerts (insurance, claims) — trigger: crew asking to be notified of time-sensitive items

### Future Consideration (v2+) — Enhanced Workflow

Defer until v1.x is stable and validated.

- [ ] High-contrast / outdoor display mode — defer: low-end accessibility concern, address when crew reports readability issues in field
- [ ] Photo attachment in field observations — defer: file upload queue adds significant complexity; text notes cover 90% of use cases
- [ ] Per-module mobile offline views (beyond crop plans) — defer: requires module-by-module offline data modeling; complex

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Mobile-responsive layouts | HIGH | MEDIUM | P1 |
| Touch-friendly forms | HIGH | LOW | P1 |
| Sync status indicator | HIGH | LOW | P1 |
| PWA install prompt improvement | HIGH | LOW | P1 |
| Offline read (dashboard + crop plans) | HIGH | MEDIUM | P1 |
| Field observation submission | HIGH | MEDIUM | P2 |
| Optimistic UI / submission feedback | MEDIUM | LOW | P2 |
| Push notifications (deadline alerts) | MEDIUM | MEDIUM | P2 |
| One-tap quick actions on dashboard | MEDIUM | LOW | P2 |
| High-contrast / outdoor display mode | MEDIUM | LOW | P3 |
| Photo attachments | LOW | HIGH | P3 |
| Per-module offline views | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch — crew can't use portal on mobile without these
- P2: Should have — crew adopts daily use with these in place
- P3: Nice to have — future milestone

---

## Competitor Feature Analysis

| Feature | Farmbrite | Agworld | FarmKeep | Our Approach |
|---------|-----------|---------|----------|--------------|
| Mobile access | Native iOS/Android apps | Native apps + web | Native apps | PWA — no app store, same codebase, sufficient for small internal team |
| Offline mode | Partial (varies by module) | Limited | Not documented | Offline-first with IndexedDB queue; already partially implemented |
| Field data entry | Forms in native app | Scouting forms + photo | Task checklists | Structured observation forms + offline queue |
| Dashboard | Role-based dashboards | Agronomist-focused analytics | Simple task view | Module-access-aware quick-glance, tailored to farm ops roles |
| Push notifications | Yes (native app) | Yes (native app) | Limited | Web Push via service worker; iOS requires install first |
| Team coordination | Task assignment + messaging | Advisor-grower messaging | Shared task lists | Structured field observations; no in-app chat (deliberate) |

**Takeaway:** Commercial competitors use native apps to deliver offline + push notifications reliably. A PWA closes most of that gap for an internal 2-5 person team at zero app store overhead — the tradeoff is acceptable given the constraints.

---

## Sources

- [7 Best Mobile Apps for Farm Management - FarmstandApp](https://www.farmstandapp.com/67360/7-best-mobile-apps-for-farm-management/) — competitor feature set (MEDIUM confidence)
- [Farmbrite Product Features](https://www.farmbrite.com/product) — feature comparison baseline (MEDIUM confidence)
- [FarmKeep Farm Task Management](https://www.farmkeep.com/features/farm-task-management) — small team coordination patterns (MEDIUM confidence)
- [Offline and background operation — MDN PWA Guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation) — Background Sync API, Periodic Background Sync browser support (HIGH confidence)
- [Best practices for PWAs — MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Best_practices) — offline-first patterns, install prompt (HIGH confidence)
- [Offline sync conflict resolution patterns — sachith.co.uk, Feb 2026](https://www.sachith.co.uk/offline-sync-conflict-resolution-patterns-architecture-trade%E2%80%91offs-practical-guide-feb-19-2026/) — conflict resolution strategies, anti-patterns (MEDIUM confidence)
- [UX Research for Agriculture Mobile App — Medium/Nishant Dogra](https://medium.com/@mrdogra007/ux-research-analysis-and-strategy-check-list-for-agriculture-based-mobile-application-da5c58efd528) — farmer UX constraints: low-end devices, sunlight readability, offline needs (MEDIUM confidence)
- [Agriculture app design guide — Gapsy Studio](https://gapsystudio.com/blog/agriculture-app-design/) — 7:1 contrast ratio for sunlight, task-oriented flows over dense dashboards (MEDIUM confidence)
- [Offline + Sync Architecture for Field Operations — Alpha Software](https://www.alphasoftware.com/blog/offline-sync-architecture-tutorial-examples-tools-for-field-operations) — field operations offline architecture patterns (MEDIUM confidence)
- [Agritech Mobile App Trends — Farmonaut](https://farmonaut.com/blogs/agritech-mobile-apps-top-7-agriculture-mobile-app-trends) — industry trends and feature expectations (LOW confidence, marketing source)

---

*Feature research for: Mobile PWA farm operations portal (W. Hughes Farms)*
*Researched: 2026-03-20*
