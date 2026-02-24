# Feature Research

**Domain:** USDA NOP Organic Certification Audit System (subsequent milestone — Case IH Field Ops API + NOP audit reporting)
**Researched:** 2026-02-23
**Confidence:** MEDIUM-HIGH (NOP regulatory requirements HIGH; Case IH API internals MEDIUM due to limited public schema docs)

---

## Context: What Already Exists

The existing organic-cert app already has: NextAuth/RBAC, Prisma/PostgreSQL, field enterprise management, audit logger middleware, lot number auto-generation (cropYear-crop-fieldName), mass balance calculations, CSV import/export, PDF generation via @react-pdf/renderer. This research focuses on the **new milestone features** needed to pass a USDA NOP inspection and integrate Case IH Field Ops data.

---

## Feature Landscape

### Table Stakes (Inspection Fails Without These)

Features that USDA NOP inspectors require per 7 CFR Part 205 and the 2024 Strengthening Organic Enforcement rule. Missing any of these = certification denied or suspended.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **3-Year Field History per Parcel** | 7 CFR 205.202: no prohibited substances for 3 years before first organic harvest. Inspector verifies at every annual inspection. | MEDIUM | Must capture field ID, crop grown, inputs applied, dates per crop year. Case IH pull covers recent ops; older history needs manual entry or import. |
| **Input Application Records (All Inputs)** | 7 CFR 205.103: records must demonstrate compliance. Inspectors do traceback from sale → field → input log. | MEDIUM | Must capture: material name, certifier-approved status, application date, rate, field/lot applied, reason for use. Receipts linkable. |
| **Seed and Planting Stock Sourcing** | NOP requires certified organic seed when commercially available; if not, must document commercial availability search (3+ suppliers contacted). | MEDIUM | Capture: seed variety, supplier, organic cert status, invoice/seed tag reference, fallback justification if conventional used. |
| **Harvest Records (Yield, Date, Field, Lot)** | Mass balance audit requires harvested quantity per field per crop year to reconcile against sales. SOE 2024 requires lot linkage on all non-retail containers. | MEDIUM | Must auto-generate lot number (existing pattern: cropYear-crop-fieldName). Capture: harvest date, yield quantity/unit, equipment, storage location. Case IH harvest data (combine telemetry) is primary source. |
| **Lot Number → Field Traceability** | SOE 2024 final rule (effective March 2024): every non-retail container must have lot code linkable to audit trail. Traceback audit conducted at every annual inspection. | MEDIUM | Existing lot gen covers format; need linkage from lot → harvest record → field history → input records. |
| **Mass Balance Calculation (In/Out)** | Certifiers now required to complete mass balance audits at every annual inspection (SOE 2024). Inspector compares total harvested vs total sold ± inventory. Imbalance = compliance flag. | HIGH | Existing mass balance logic (C5.0) is partial — needs to cover full harvest-to-sale chain per lot/crop/field. |
| **Organic System Plan (OSP) Record Store** | The OSP is the canonical document inspectors verify against. Operations must maintain current OSP and show it matches actual practice. | LOW | Existing app likely has OSP sections; need to ensure field records reference back to OSP commitments. |
| **Sales Records Linked to Lots** | Inspectors trace from invoice → lot → harvest → field to complete the chain. Sales records must show: buyer, quantity, date, crop type, lot code, organic claim. | MEDIUM | Standard invoice model; key is the lot code foreign key. |
| **Equipment Cleaning/Contamination Prevention Log** | Inspector verifies physical separation of organic/conventional during harvest, storage, transport. Equipment cleaning records prevent commingling findings. | LOW | Simple log: equipment ID, date cleaned, method, who performed, previous use if mixed. |
| **Buffer Zone Documentation** | 7 CFR 205.202(c): distinct boundaries and buffer zones. Inspectors verify on-site that field maps match physical reality and buffers are adequate (typically 25-30 ft from neighboring conventional). | MEDIUM | Need field boundary records with adjacent land use notation. GPS coordinates preferred. Map display (even simple) is table stakes per certifier guidance. |
| **Input Material Approval Status** | NOP prohibits synthetic substances unless specifically listed (205.601). Inspectors check that inputs are on the certifier's approved list or carry OMRI/WSDA listing. | MEDIUM | Each input record needs approval status field (OMRI-listed, certifier-approved, custom justification). Validation against approved list prevents accidental prohibited-substance violations. |
| **5-Year Record Retention** | 7 CFR 205.103(b): records must be kept for 5 years (NOP requirement; note SOE may specify 3 years beyond creation — effective retention window is 5 years minimum). Inspector can request any record from prior certification cycle. | LOW | Soft-delete / archive policy needed; no hard deletion within retention window. Existing append-only store covers this for logged events; needs explicit coverage for all record types. |
| **Print-Ready Inspection Report (PDF)** | Inspectors work on-site from paper. The farm must be able to hand an inspector a complete package. Certifiers like CCOF and Oregon Tilth publish explicit checklists of what must be in the packet. | HIGH | Existing PDF renderer covers format. Report must include: OSP summary, field list with 3-year history, input log, seed sources, harvest/lot summary, sales/mass balance, buffer zone map notes. |
| **Append-Only Audit Log with Tamper Evidence** | Regulatory requirement for immutable records. SOE 2024 added fraud prevention plan requirements. Inspector or certifier can request audit trail of who modified what and when. | HIGH | Existing audit logger middleware needs tamper-evidence layer (checksums/signatures). Append-only store with no soft-delete on audit events. |

---

### Differentiators (Faster Prep, Fewer Inspection Headaches)

Features that make audit prep materially faster and reduce compliance risk, but won't fail an inspection if absent.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Case IH Field Ops API Auto-Pull** | Eliminates manual data entry for tillage, planting, application, and harvest operations. Machine data from cab → audit record with zero transcription. Core differentiator vs. paper-based or manual CSV tools. | HIGH | CNH OAuth2 Authorization Code flow (identity.cnhind.com). Pulls: GPS field boundaries, activity types, machine telemetry (hours, area coverage, working mode). Existing OAuth2 sync in farm-budget app; port and adapt. Note: agronomic data from Linked Accounts not available via API per CNH portal docs — only direct-account activity data. |
| **Prohibited Input Pre-Validation** | Flags before application (or on record entry) if a material is not on the approved inputs list. Prevents the #1 certification violation: accidental prohibited-substance use. | MEDIUM | Requires a maintained approved-inputs reference list (OMRI, NER, certifier list). Simple lookup on record save. High inspector-trust factor per organic cert software review. |
| **Fraud Prevention Plan Documentation** | SOE 2024 requires a fraud prevention plan in the OSP. A structured screen to document supplier verification steps and organic status checks differentiates from tools that ignore this new requirement. | LOW-MEDIUM | Form-based: list of organic suppliers, verification method (cert check, Organic Integrity Database lookup), date verified. Lightweight but newly required. |
| **Commercial Availability Search Log** | When conventional seed is used because organic was unavailable, NOP requires documentation of ≥3 suppliers contacted. This is a known inspection trap — missing paperwork = finding. | LOW | Simple log: crop variety, date searched, suppliers contacted, results, justification. Linked to seed source record. |
| **Transition Status Tracker (Year 1/2/3)** | For fields converting to organic, track which year of 3-year transition each field/parcel is in. Prevents premature organic claims. Certifier-trusted visual indicator. | LOW-MEDIUM | Status field on field record: conventional / transition-year-1 / transition-year-2 / certified. Auto-advance based on first-prohibited-substance-free date. |
| **Manure Application 90/120-Day Interval Enforcer** | NOP 205.203(c): raw manure must be applied 120 days before harvest for crops contacting soil, 90 days otherwise. Violation = automatic certification issue. | MEDIUM | Date diff calculation on harvest record vs. most recent manure application record for that field. Warning/block if interval not met. |
| **Audit Report Pre-Flight Check** | Before generating the PDF report, run a completeness check: flag fields with incomplete 3-year history, missing seed sources, inputs lacking approval status, lots without sales linkage. Shows a "ready for inspection" score. | MEDIUM | Business logic layer over existing data. High value: farm managers know gaps before the inspector arrives, not during. |
| **Case IH Data Field Mapping UI** | Raw Case IH operation records won't map cleanly to NOP categories. A lightweight UI to review pulled operations and confirm/adjust field-to-lot assignment, activity type, and input material before they enter the audit record. | MEDIUM | Prevents garbage-in from machine data. One-time mapping per operation type; subsequent auto-match based on prior mappings. |
| **Photo Evidence Attachment (Field Documentation)** | Inspectors increasingly accept digital photo evidence (residue test results, compost pile temps, buffer zone photos). Attaching photos to input/harvest/field records strengthens the audit package. | MEDIUM | File upload to storage (S3 or equiv); thumbnail in UI; included as embedded pages or appendix in PDF report. Mobile-first consideration for operators taking photos in field. |
| **Audit Log Export for Regulator (CSV/PDF)** | Certifying agents may request full audit trail exports for compliance review. One-click export of all audit events filtered by date range, user, resource type. | LOW | Existing audit viewer + export hook. Standard feature; differentiating because most farm tools don't expose it. |
| **Configurable Record Retention / Archive Policy** | Operations vary in how long they want active vs. archived records. Configurable retention (minimum 5 years enforced, soft-archive older records) prevents UI clutter without violating NOP. | LOW-MEDIUM | Admin setting; archive flag on records older than X years. Hard floor at 5 years to enforce NOP minimum. |
| **Background Sync + Snapshot Jobs** | Scheduled Case IH data pulls (daily/weekly) and audit log snapshot backups. Ensures records are never out of sync and provides a recoverable audit trail even if app DB is corrupted. | MEDIUM | Background job infrastructure (existing or add cron/queue). Snapshot to cold storage or JSON export. Tamper-evidence checksums on snapshots. |
| **Field Correction/Annotation Workflow** | Operators need to correct machine data errors (wrong field assigned, incorrect rate) without destroying the audit trail. Correction creates a new record referencing the original; original is never deleted. | MEDIUM | Append-only correction model: new record with type=CORRECTION, references original record ID, captures who corrected, why, and when. Existing append-only store pattern applies directly. |
| **Organic Integrity Database Cross-Reference** | USDA's Organic Integrity Database (ams.usda.gov/organic-integrity) lists all certified operations. Cross-referencing seed suppliers and input vendors against this database provides automatic verification. | HIGH | External API or scrape; verify supplier cert status at record entry time. Niche but high-trust feature for inspectors. |

---

### Anti-Features (Deliberately Do Not Build)

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| **Automated Compliance Scoring / Pass-Fail Indicator** | Seems helpful — give farm manager a "compliance score." | Inspector makes the certification determination, not software. Displaying a "pass" score could give false confidence; a "fail" score could create legal liability. USDA explicitly does not delegate certification decisions to software. | Build a pre-flight completeness check (are records present and complete?) without making a compliance determination. Flag gaps, not verdicts. |
| **Inspector Portal / Digital Access for Inspectors** | Seems modern — give inspector direct login to view records. | Inspectors work on-site with paper packets; certifying agents operate independently from farm management software. Building a portal adds auth complexity, data-sharing liability, and certifier relationship management — none of which are in scope for v1. | Print-ready PDF report is the right interface for inspectors. |
| **Real-Time Push Notifications for Field Events** | Seems useful — notify manager when machine completes field. | Farming happens in connectivity-poor environments. Real-time push is unreliable for this use case and adds infrastructure complexity (WebSockets, push services) with marginal value over a sync-on-open model. | Background sync job pulls Case IH data on a schedule; UI shows last-sync timestamp. |
| **Multi-Certifier / EU / State Organic Program Support** | Certifiers have different forms and rules. | Building for multiple standards simultaneously fragments focus, creates conditional logic sprawl, and delays NOP launch. USDA NOP is the standard for US organic — get it right first. | USDA NOP only for v1. Architecture should isolate certifier-specific logic for future extensibility. |
| **Predictive Analytics / AI Crop Recommendations** | "Make the data useful beyond compliance." | Outside scope of an audit system. Adds model infrastructure, data science dependencies, and a fundamentally different UX paradigm. The farm-budget and other ecosystem apps are better homes for optimization features. | Surface raw data from Case IH clearly. Prescription file support (sending Rx files via FieldOps API) is a v2 feature if needed. |
| **Blockchain Ledger for Audit Records** | Some competitors market blockchain for tamper-evidence. | Cryptographic checksums on an append-only PostgreSQL store provide equivalent tamper evidence for regulatory purposes at a fraction of the complexity. Blockchain adds infrastructure cost, latency, and operational burden with no regulatory requirement or inspector benefit. | Append-only store + SHA-256 checksums + signed snapshots. Passes any regulatory audit without a blockchain. |
| **Consumer-Facing Organic Traceability QR Codes** | "Let consumers scan and see field history." | Consumer marketing is a separate product domain. The NOP audit system is a back-office tool for farm managers and certifiers. QR code traceability requires public-facing infrastructure, marketing copy, branding, and customer support — none of which belong in an audit system. | Defer to a dedicated consumer transparency product if needed in v2+. |
| **Native Mobile App (v1)** | Field operators want mobile record entry. | Already scoped out in PROJECT.md. Web-first with responsive design bridges the gap for v1. Native mobile adds build pipeline complexity, app store management, and offline sync architecture. | Responsive design now; native mobile v2. |

---

## Feature Dependencies

```
[Case IH Field Ops API Pull]
    └──produces──> [Field Operation Records]
                       ├──requires──> [Field/Lot Assignment Mapping UI]
                       │                  └──produces──> [Audit-ready Input/Harvest Records]
                       └──requires──> [Field Boundary Records]

[Harvest Records]
    └──requires──> [Lot Number Generation (existing)]
    └──requires──> [Field History Records]
    └──feeds──>    [Mass Balance Calculation]
                       └──requires──> [Sales Records Linked to Lots]

[Input Application Records]
    └──requires──> [Input Material Approval Status]
    └──triggers──> [Prohibited Input Pre-Validation]
    └──triggers──> [Manure 90/120-Day Interval Check]

[Seed Source Records]
    └──requires──> [Commercial Availability Search Log] (conditional — only if conventional seed used)

[Print-Ready Inspection Report]
    └──requires──> [3-Year Field History]
    └──requires──> [Input Application Records]
    └──requires──> [Harvest Records + Lots]
    └──requires──> [Sales Records + Mass Balance]
    └──requires──> [Seed Source Records]
    └──requires──> [Buffer Zone Documentation]
    └──enhanced by──> [Audit Report Pre-Flight Check]
    └──enhanced by──> [Photo Evidence Attachments]

[Append-Only Audit Log with Tamper Evidence]
    └──required by──> [Audit Log Export for Regulator]
    └──required by──> [Field Correction/Annotation Workflow]
    └──requires──> [Configurable Retention/Archive Policy]

[Transition Status Tracker]
    └──requires──> [3-Year Field History]
    └──feeds──>    [Field eligibility for organic claim]
```

### Dependency Notes

- **Case IH API Pull requires Field Boundary Records:** The CNH API returns operations associated with grower/farm/field/boundary (GFFB hierarchy). Field boundaries must exist in the app before pulled operations can be assigned to fields.
- **Mass Balance requires Harvest + Sales Records:** Both must be complete for a given crop year before the inspector can run a mass balance audit. Partial records = incomplete audit = certification risk.
- **Inspection Report requires all table-stakes records:** The PDF report is a synthesis layer — it cannot generate a complete report until all underlying records exist. Pre-flight check surfaces which records are missing.
- **Input Approval Status is a dependency, not an enhancement:** Without approval status on each input record, inspectors cannot verify prohibited-substance compliance. This gates the inspection report, not just display.
- **Field Correction Workflow conflicts with simple edit:** Simple record edits destroy the audit trail. Correction must use append-only model to preserve inspector-visible history. These two approaches are mutually exclusive on audit records.

---

## MVP Definition

This is a subsequent milestone, not a greenfield project. "MVP" here means: minimum addition to the existing app that enables a complete, inspection-passing audit report using Case IH data.

### Launch With (v1 milestone)

Must-have for the milestone to deliver its core value promise ("hand an inspector a complete, print-ready audit report with zero manual data entry").

- [ ] **Case IH Field Ops API integration** — OAuth2 pull for field operations (tillage, planting, application, harvest). Without this, the milestone's differentiator doesn't exist.
- [ ] **Field Operation → Audit Record mapping** — Pulled Case IH data mapped to NOP-compliant record fields (input application records, harvest records, tillage logs).
- [ ] **3-Year Field History per parcel** — Combined Case IH pull + manual entry for pre-API history. Inspector-required.
- [ ] **Harvest records with lot linkage** — Date, yield, field, lot number (existing lot gen), Case IH data source.
- [ ] **Input application records with approval status** — All inputs logged with OMRI/certifier-approved flag.
- [ ] **Mass balance calculation (full chain)** — Harvest qty vs. sales qty per crop/lot, not just partial C5.0 rule.
- [ ] **Print-ready USDA NOP inspection report (PDF)** — Complete packet: field history, input log, seed sources, harvest/lots, mass balance, buffer zones.
- [ ] **Append-only audit store with tamper evidence (checksums)** — Regulatory compliance; existing logger needs checksum layer.
- [ ] **Seed source records** — Including commercial availability search log for conventional seed fallbacks.
- [ ] **Buffer zone documentation** — Field boundary records with adjacent land use notation.

### Add After Validation (v1.x)

- [ ] **Prohibited input pre-validation** — High value but requires maintaining an approved-inputs reference list. Add once core records are working.
- [ ] **Audit report pre-flight check** — Completeness scoring before PDF generation. Add once report structure is stable.
- [ ] **Photo evidence attachments** — Operators need mobile capability to be useful. Add with responsive design work.
- [ ] **Fraud prevention plan documentation** — SOE 2024 requirement; structured form within OSP. Lightweight add once core is solid.
- [ ] **Manure 90/120-day interval enforcer** — Date logic; add after harvest + input records are stable.
- [ ] **Configurable retention/archive policy** — Admin feature; add before production data accumulates.

### Future Consideration (v2+)

- [ ] **Organic Integrity Database cross-reference** — External API dependency; high complexity, moderate value.
- [ ] **Transition status auto-advance** — Useful but requires accurate historical data that may not exist at launch.
- [ ] **Background sync + snapshot jobs** — Infrastructure for production scale; important but not blocking inspection workflow.
- [ ] **Case IH prescription (Rx) file send** — Reverse integration (app → machine); out of scope for audit focus.
- [ ] **Native mobile app** — Already deferred in PROJECT.md.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Case IH Field Ops API integration | HIGH | HIGH | P1 |
| 3-Year field history per parcel | HIGH | MEDIUM | P1 |
| Harvest records with lot linkage | HIGH | MEDIUM | P1 |
| Input application records + approval status | HIGH | MEDIUM | P1 |
| Mass balance (full chain) | HIGH | HIGH | P1 |
| Print-ready NOP inspection report PDF | HIGH | HIGH | P1 |
| Append-only audit store + tamper evidence | HIGH | HIGH | P1 |
| Seed source records + commercial availability log | HIGH | LOW | P1 |
| Buffer zone documentation | HIGH | MEDIUM | P1 |
| Equipment cleaning log | MEDIUM | LOW | P1 |
| Audit report pre-flight check | HIGH | MEDIUM | P2 |
| Prohibited input pre-validation | HIGH | MEDIUM | P2 |
| Photo evidence attachments | MEDIUM | MEDIUM | P2 |
| Fraud prevention plan docs (SOE 2024) | MEDIUM | LOW | P2 |
| Manure 90/120-day interval enforcer | MEDIUM | LOW | P2 |
| Field correction/annotation workflow | MEDIUM | MEDIUM | P2 |
| Configurable retention/archive policy | MEDIUM | LOW | P2 |
| Audit log export for regulator | MEDIUM | LOW | P2 |
| Transition status tracker | LOW | MEDIUM | P3 |
| Organic Integrity DB cross-reference | MEDIUM | HIGH | P3 |
| Background sync + snapshot jobs | MEDIUM | MEDIUM | P3 |

**Priority key:**
- P1: Must have for milestone launch
- P2: Add after core is working and validated
- P3: Future milestone or v2

---

## Competitor Feature Analysis

| Feature | Granular / AgVance | COG Pro / AgriNect | Our Approach |
|---------|--------------------|--------------------|--------------|
| Machine data integration | Ag equipment integrations (generic JD, CNH) | Manual entry or CSV | Direct Case IH FieldOps API — more automated than competitors |
| Input approval validation | Input library, some NOP flags | NOP-specific validation before application | NOP-approved status field + warning on save |
| Audit-ready reports | Generic farm reports, some organic modules | Purpose-built NOP report generation | Purpose-built, print-ready NOP packet with all inspector-required sections |
| Mass balance audit | Basic inventory tracking | Mass balance module | Full chain: harvest → storage → sales per lot |
| Lot traceability | Lot numbers on harvest records | Lot tracking with traceback | Lot number → full field history chain per SOE 2024 |
| Append-only records | Standard edit/delete model | Not documented | Append-only + checksums — regulatory differentiator |
| Buffer zone mapping | Field mapping tools | Basic boundary records | Boundary + adjacent land use; GPS coordinates |
| Photo evidence | Some platforms support | Not documented | File attachment on any record type |

**Observation:** Competitors either cover general farm management (Granular, AgVance) with weak NOP specificity, or are NOP-specific (COG Pro) but lack machine data integration. The Case IH API pull combined with purpose-built NOP audit records is the actual differentiator — no competitor appears to combine both.

---

## NOP Inspector Report: Required Sections

Based on certifier documentation (CCOF, Oregon Tilth, MOSA) and 7 CFR 205, the print-ready PDF must include these sections to pass inspector review:

1. **Operation Overview** — Farm name, certifier, certification number, inspection date, OSP version
2. **Field/Parcel List** — All certified fields: ID, acreage, location, GPS boundaries, transition status, adjacent land use + buffer notation
3. **3-Year Field History per Parcel** — Crop grown each year, inputs applied, dates, prohibition-free start date
4. **Input Application Log** — All materials applied: name, date, field, rate, approval status, receipt reference
5. **Seed and Planting Stock Records** — Variety, supplier, organic cert status, purchase reference, commercial availability search if conventional
6. **Harvest Log** — Date, field, crop, variety, quantity, lot number, equipment used, storage destination
7. **Storage Inventory Summary** — Lot-keyed inventory: received, shipped, on-hand balances
8. **Sales Records** — Buyer, date, quantity, lot number, organic claim on invoice
9. **Mass Balance Summary** — Total harvested vs. total sold ± inventory per crop/lot; inspector reconciliation table
10. **Equipment Cleaning Log** — Equipment ID, date, method, previous use (for commingling prevention verification)
11. **Audit Trail Summary** — Who made what changes and when (tamper-evident log excerpt)

---

## Case IH FieldOps API: What We Can Actually Pull

**Confidence: MEDIUM** — CNH public docs are limited; full schema requires authenticated developer access. Based on available documentation:

**Available via API (confirmed):**
- Farm organizational hierarchy: grower → farm → field → boundary (GFFB)
- Field boundaries (GPS polygon data)
- Vehicle telemetry: GPS location, engine hours, fuel use, working mode, ground speed, area coverage
- Operations records associated with field activities
- File upload/retrieval for prescription (Rx) files and agronomic data files
- Activity types and task data

**Authentication:**
- OAuth2 Authorization Code flow
- Authorization endpoint: `https://identity.cnhind.com/authorize`
- Token endpoint: `https://identity.cnhind.com/oauth/token`
- Scopes: `offline_access` (refresh token for long-lived sync)
- Rate limit: 120 req/sec; 429 on breach

**Known limitation:**
- Per CNH developer portal: "Agronomic data from a Linked Account in the FieldOps portal is not made available through the FieldOps API." This means if the operator has linked a third-party agronomic account (e.g., Climate FieldView), that data is not accessible via API. Only data from the operator's direct Case IH account is available.

**Data gap to plan for:**
- Detailed as-planted, as-applied, as-harvested agronomic record schemas are not documented publicly. The API replaced the legacy Ag Data and CONNECT Machine Data APIs. Full field schemas likely require authenticated dev portal access + Swagger/OpenAPI spec download. The milestone implementation will need to handle schema discovery during development and build a flexible field mapper UI to accommodate variable data fields.

---

## Sources

- [7 CFR Part 205 — National Organic Program (eCFR)](https://www.ecfr.gov/current/title-7/subtitle-B/chapter-I/subchapter-M/part-205)
- [USDA NOP Strengthening Organic Enforcement Final Rule — Federal Register (Jan 2023, effective March 2024)](https://www.federalregister.gov/documents/2023/01/19/2023-00702/national-organic-program-nop-strengthening-organic-enforcement)
- [SOE Frequently Asked Questions — USDA AMS](https://www.ams.usda.gov/rules-regulations/strengthening-organic-enforcement/faq)
- [Mastering Recordkeeping for Crop Organic Operations — Oregon Tilth](https://tilth.org/mastering-organic-recordkeeping/) — HIGH confidence; Oregon Tilth is an accredited certifying agent
- [Mass Balance and Traceback Inspection Audits Explained — MOSA](https://mosaorganic.org/education-resources/organic-cultivator-newsletter/mass-balance-and-traceback-inspection-audits-explained/) — MEDIUM confidence; MOSA is an accredited certifier
- [Buffer Zone Documentation — Croptracker](https://www.croptracker.com/blog/croptracker-feature-use-case-organic-buffer-zone-mapping.html) — MEDIUM confidence; software vendor, but cites certifier requirements accurately
- [Organic Integrity Through Inspections — USDA Blog](https://www.usda.gov/about-usda/news/blog/organic-101-ensuring-organic-integrity-through-inspections) — HIGH confidence; official USDA source
- [7 Best Record-Keeping Tools for Organic Certification — FarmstandApp](https://www.farmstandapp.com/30165/7-best-record-keeping-tools-for-organic-certification/) — LOW-MEDIUM confidence; aggregator article, useful for competitor landscape
- [CNH Developer Portal — FieldOps API](https://develop.cnh.com/api-guides/fieldops-api) — MEDIUM confidence; official CNH docs but limited public schema detail
- [CNH Developer Portal — OAuth2 Tokens](https://develop.cnh.com/api-guides/fieldops-api/tokens) — HIGH confidence; official auth flow docs
- [CNH Developer Portal — Vehicle Telemetry](https://develop.cnh.com/api-guides/fieldops-api/vehicle-telemetry) — HIGH confidence; official telemetry field list
- [CNH Developer Portal — FieldOps Portals](https://develop.cnh.com/get-started/fieldops-portals) — HIGH confidence; note on Linked Account limitation is official
- [Case IH FieldOps API Partnerships Announcement — CNH Media](https://media.cnh.com/asia-pacific-english/case-ih/case-ih-goes-live-with-fieldops--connectivity-included-and-new-api-partnerships/s/136e4974-5a6e-4a05-92d1-a53c0e7b4366) — MEDIUM confidence; marketing announcement confirming 40+ API partners

---

*Feature research for: USDA NOP Organic Certification Audit System — Case IH Field Ops + NOP Audit Reporting Milestone*
*Researched: 2026-02-23*
