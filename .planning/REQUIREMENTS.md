# Requirements: Farm Operations Platform

**Defined:** 2026-03-04
**Core Value:** Complete, trustworthy records for every bushel — from the field it came from to the settlement it was paid on — with zero tolerance for lost data or undetected discrepancies.

## v5.0 Requirements

Requirements for v5.0 Glomalin Portal — Next.js + Supabase Scaffold. Each maps to roadmap phases.

### Supabase Foundation

- [x] **SUP-01**: Supabase project schema (profiles, module_access) deployed with RLS policies and auto-profile trigger
- [x] **SUP-02**: Browser and server Supabase clients configured for Next.js 14 App Router SSR

### Authentication

- [ ] **AUTH-01**: User can log in with email and password via Supabase signInWithPassword
- [x] **AUTH-02**: Unauthenticated users are redirected to /login by middleware

### Authorization

- [x] **RBAC-01**: User profile has a role (admin, agronomist, operator, viewer) defaulting to viewer on signup
- [x] **RBAC-02**: Admin routes (/admin) redirect non-admin users to /dashboard
- [x] **RBAC-03**: Module routes (/app/*) check module_access and redirect denied users to /dashboard?denied=true
- [ ] **RBAC-04**: Admin can toggle any user's module access and change their role from the admin panel

### Portal UI

- [ ] **UI-01**: Public landing page with React Flow node map and dark soil aesthetic
- [ ] **UI-02**: Dashboard shows module cards — locked/grayed for modules without access
- [ ] **UI-03**: Admin page renders user table with module toggle switches and role dropdown
- [ ] **UI-04**: Module shell pages render module name with "coming soon" placeholder

### Scaffold

- [x] **SCF-01**: Next.js 14 App Router project with Tailwind CSS and dark soil color palette (font-mono)
- [x] **SCF-02**: Module definitions in lib/modules.js with id, label, sublabel, route
- [x] **SCF-03**: .env.local.example with Supabase connection variables

## v4.0 Requirements (Complete)

### Bug Fixes

- [x] **FIX-01**: User can save field edits in farm-registry and see reportingAcres, organicAcres, and ownership persist correctly after page refresh
- [x] **FIX-02**: Farm-registry PUT /api/fields/:id accepts all form-submitted fields including growerId

### Farm Budget Polish

- [x] **BUD-01**: Field editor preview shows both per-acre cost and total field cost for every budget category
- [x] **BUD-02**: Negative Profit/AC and Profit (w/ Payments) values display in red in the field editor preview
- [x] **BUD-03**: Orders tab is visible in navigation and fully functional
- [x] **BUD-04**: Deliveries tab is visible in navigation and fully functional

### FSA Crop Sync

- [x] **FSA-01**: Crop sync preview pulls enterprise-level data from farm-budget macro rollup
- [x] **FSA-02**: Sync preview displays side-by-side comparison of FSA CLU acres vs farm-budget enterprise acres
- [x] **FSA-03**: Only tillable CLUs with actual crop assignments are included in sync proposals
- [x] **FSA-04**: CLUs already marked as "reported" are excluded from sync proposals

### Settlement Reconciliation

- [x] **REC-01**: User can configure per-crop weight discrepancy tolerance (% or lbs)
- [x] **REC-02**: Multi-buyer season summary view shows all buyers with totals and variance
- [x] **REC-03**: Fuzzy matching by date and weight when exact ticket number fails
- [x] **REC-04**: Dispute resolution with structured status, notes, and resolution date

## Future Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Crop Year Accounting & QBO Integration (v6.0+)

- **QBO-01**: QBO OAuth2 integration with manual sync button
- **QBO-02**: Crop year accounting (two-date model: cash date + crop year)
- **QBO-03**: Budget vs actual variance tracking
- **QBO-04**: Whole-farm P&L dashboard with 3-year rolling view

### Audit Infrastructure

- **AUD-01**: Append-only audit store with tamper-evidence
- **AUD-02**: Audit viewer with filtering by user/resource/time
- **AUD-03**: Audit log export for regulators

### Mobile & Media

- **MOB-01**: Mobile-friendly responsive design across all modules
- **MOB-02**: Photo evidence attachment for field documentation

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Native mobile app | Web-first, responsive design for now |
| Real-time field notifications | Not needed for audit prep workflow |
| Automated compliance scoring | Inspector makes the call, we provide records |
| Inspector portal/login | Inspectors receive print reports, not digital access |
| Elevator-side software | Hughes Farm is the seller, not the elevator |
| Real-time futures price integration | Prices come from contracts already signed |
| Automated PDF settlement parsing | PDF formats vary wildly across buyers |
| Rewriting existing module frameworks | Each module works — no framework migrations |
| User signup/registration flow | Admin creates users; no self-registration for v5.0 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FIX-01 | Phase 20 | Complete |
| FIX-02 | Phase 20 | Complete |
| BUD-01 | Phase 21 | Complete |
| BUD-02 | Phase 21 | Complete |
| BUD-03 | Phase 21 | Complete |
| BUD-04 | Phase 21 | Complete |
| FSA-01 | Phase 22 | Complete |
| FSA-02 | Phase 22 | Complete |
| FSA-03 | Phase 22 | Complete |
| FSA-04 | Phase 22 | Complete |
| REC-01 | Phase 23 | Complete |
| REC-02 | Phase 23 | Complete |
| REC-03 | Phase 23 | Complete |
| REC-04 | Phase 23 | Complete |
| SCF-01 | Phase 24 | Pending |
| SCF-02 | Phase 24 | Pending |
| SCF-03 | Phase 24 | Pending |
| SUP-01 | Phase 24 | Pending |
| SUP-02 | Phase 24 | Pending |
| AUTH-01 | Phase 25 | Pending |
| AUTH-02 | Phase 25 | Complete |
| RBAC-01 | Phase 25 | Complete |
| RBAC-02 | Phase 25 | Complete |
| RBAC-03 | Phase 25 | Complete |
| RBAC-04 | Phase 25 | Pending |
| UI-01 | Phase 26 | Pending |
| UI-02 | Phase 26 | Pending |
| UI-03 | Phase 26 | Pending |
| UI-04 | Phase 26 | Pending |

**Coverage:**
- v5.0 requirements: 15 total
- Mapped to phases: 15 (all mapped)
- Unmapped: 0

---
*Requirements defined: 2026-03-04*
*Last updated: 2026-03-04 after v5.0 roadmap creation*
