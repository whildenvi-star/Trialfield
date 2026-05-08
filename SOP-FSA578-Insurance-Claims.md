# Standard Operating Procedure: FSA 578, Insurance & Claims Modules

**W. Hughes Farms — Glomalin Portal**
**portal.whughesfarms.com**

| Field | Value |
|---|---|
| Version | 1.0 |
| Effective Date | March 12, 2026 |
| Author | W. Hughes Farms |
| System | Glomalin Portal (Next.js / Supabase) |

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Definitions & Abbreviations](#3-definitions--abbreviations)
4. [System Access](#4-system-access)
5. [Module 1 — FSA 578 Acreage Reporting](#5-module-1--fsa-578-acreage-reporting)
6. [Module 2 — Insurance Decision Tool](#6-module-2--insurance-decision-tool)
7. [Module 3 — Claims Lifecycle](#7-module-3--claims-lifecycle)
8. [Cross-Module Workflows](#8-cross-module-workflows)
9. [Deadlines & Compliance Calendar](#9-deadlines--compliance-calendar)
10. [Troubleshooting](#10-troubleshooting)
11. [Revision History](#11-revision-history)

---

## 1. Purpose

This SOP establishes the standard procedures for using the three interconnected compliance and risk management modules within the Glomalin Portal:

- **FSA 578** — Acreage reporting to the Farm Service Agency
- **Insurance** — Crop insurance policy management, coverage comparison, and payout simulation
- **Claims** — Crop insurance claim filing, document management, and lifecycle tracking

These procedures ensure accurate reporting, timely filings, and a complete audit trail for all farm program and insurance activities.

---

## 2. Scope

This SOP applies to all authorized users of the Glomalin Portal at W. Hughes Farms who manage FSA acreage reports, crop insurance policies, or insurance claims. It covers the 2026 crop year and should be updated annually as program rules change.

---

## 3. Definitions & Abbreviations

| Term | Definition |
|---|---|
| **CLU** | Common Land Unit — the smallest unit of land with a permanent, contiguous boundary, common land cover, and common owner/operator |
| **FSA** | Farm Service Agency (USDA) |
| **FSA-578** | Acreage Report form required by FSA for all program participants |
| **APH** | Actual Production History — the yield average used to set insurance guarantees |
| **RP** | Revenue Protection — insurance plan covering yield and price risk |
| **RP-HPE** | Revenue Protection with Harvest Price Exclusion — covers yield risk only at spring price |
| **YP** | Yield Protection — covers yield loss only |
| **FCIC** | Federal Crop Insurance Corporation |
| **CCC-576** | Notice of Loss form (FCIC required) |
| **RLS** | Row-Level Security — Supabase database access control |
| **Kanban** | Visual board with columns representing workflow stages |

---

## 4. System Access

### 4.1 Logging In

1. Navigate to **portal.whughesfarms.com**
2. Sign in with your Supabase-authenticated credentials
3. The portal dashboard displays all modules you have access to

### 4.2 Module Access Control

- Module access is governed by the `module_access` table in Supabase
- Each user is assigned access to specific modules by an administrator
- If a module tile does not appear on your dashboard, contact the farm administrator to request access

### 4.3 Navigation

- From the dashboard, click the **FSA 578**, **Insurance**, or **Claims** tile to enter the respective module
- Use the sidebar or breadcrumb navigation to move between modules
- All three modules share underlying farm and field data

---

## 5. Module 1 — FSA 578 Acreage Reporting

### 5.1 Overview

The FSA 578 module manages CLU records for acreage reporting to the Farm Service Agency. Data is organized in a hierarchy: **Farm > Tract > CLU (Field)**.

### 5.2 Viewing CLU Records

1. Open the **FSA 578** module from the dashboard
2. The **CLU Workspace** loads all records for the current crop year (2026)
3. Records are grouped by **Farm** (accordion) and then by **Tract** (nested accordion)
4. Each CLU is displayed as an editable **CLU Card** showing:
   - Farm number, tract number, CLU number, and field name
   - FSA acres, crop, irrigation status, organic status
   - Reporting flags (reported, prevented planting, double crop, cover crop)

### 5.3 Editing a CLU Record

1. Click on any CLU Card to expand the editor
2. Update the following fields as needed:

| Field | Description | Notes |
|---|---|---|
| Crop | Planted crop for this CLU | Use the **Crop Typeahead** — begin typing to search the FSA crop list |
| FSA Acres | Reported acreage | Must match FSA records |
| Irrigated | Whether the field is irrigated | Toggle on/off |
| Organic | Organic certification status | Toggle on/off |
| Double Crop | Second crop on same field in same year | Toggle on/off |
| Cover Crop | Cover crop planted | Toggle on/off |
| Grain Plant Date | Date grain was planted | Used for compliance verification |
| Use | Intended use of crop | e.g., Grain, Silage, Hay |
| Tillage (2024/2025) | Tillage practice records | For conservation compliance |
| Cover Crop (2024/2025) | Cover crop history | For conservation compliance |

3. Changes are saved automatically via PATCH to the API
4. The **Reported** flag should be toggled on once the acreage has been filed with FSA

### 5.4 Creating a New CLU Record

1. Use the **Add CLU** action within a tract grouping
2. Fill in the required fields: farm number, tract number, CLU number, crop, and acres
3. The record is created via POST to the API and appears in the workspace

### 5.5 Bulk Actions

1. Select multiple CLU records using the checkboxes
2. The **Bulk Action Bar** appears at the bottom of the workspace
3. Available bulk actions:
   - Set crop for all selected
   - Toggle irrigated / organic / cover crop flags
   - Mark as reported
4. Confirm the bulk update — changes are applied via the bulk-update API

### 5.6 Auto-Populate from Grain Data

1. Click the **Auto-Populate** button in the workspace toolbar
2. The system previews data pulled from the Grain Tickets module
3. Review the preview — verify acres, crops, and field assignments
4. Confirm to apply the auto-populated values to your CLU records

### 5.7 Validation

1. Click **Validate** in the workspace toolbar
2. The validation engine checks all CLU records for:
   - Missing required fields (crop, acres)
   - Acreage discrepancies
   - Crop eligibility issues
   - Duplicate entries
3. Warnings are displayed inline on each CLU Card
4. Resolve all warnings before generating the final report

### 5.8 Generating the Acreage Report PDF

1. Ensure all CLU records are validated with no outstanding warnings
2. Click the **Export PDF** button
3. The system generates a formatted acreage report using the PDF renderer
4. Download or print the PDF for submission to your local FSA office

---

## 6. Module 2 — Insurance Decision Tool

### 6.1 Overview

The Insurance module manages crop insurance policies, provides side-by-side coverage comparison, and includes an interactive payout simulator. Policies are linked to FSA data and grain records for accurate APH and yield tracking.

### 6.2 Viewing Policies

1. Open the **Insurance** module from the dashboard
2. The **Insurance Workspace** displays all policies for the current crop year (2026)
3. Each policy row shows:
   - Farm name, crop, plan type, coverage level
   - Planted acres, APH, guarantee
   - Actual yield (synced from grain tickets)
   - Claim alert status (yellow flag if actual < guarantee)
   - Premium per acre and agent name

### 6.3 Creating a New Policy

1. Click **Add Policy** to open the **Policy Drawer** (slide-out panel)
2. Fill in the required fields:

| Field | Description |
|---|---|
| Farm Name | Select from your registered farms |
| Farm Number | FSA farm number |
| Crop | Insured crop |
| Plan Type | RP, RP-HPE, or YP |
| Coverage Level | 50% to 85% (in 5% increments) |
| Unit Type | Basic, optional, enterprise, or whole-farm |
| Planted Acres | Acres under this policy |
| APH | Actual Production History (auto-computed if CLU data exists) |
| Premium Per Acre | Cost of coverage |
| Agent Name | Insurance agent handling this policy |
| Policy Number | Carrier-assigned policy number |
| Line Number | Line item on the policy |

3. **APH Auto-Lookup**: Click **Look Up APH** to pull the computed APH from your CLU records. The system averages APH values across matching CLU records for the farm/crop combination.
4. Click **Save** to create the policy

### 6.4 Editing a Policy

1. Click on any policy row to reopen the Policy Drawer
2. Modify fields as needed
3. Click **Save** — changes are applied via PATCH to the API

### 6.5 Deleting a Policy

1. Open the Policy Drawer for the target policy
2. Click **Delete** at the bottom of the drawer
3. Confirm the deletion — this action cannot be undone

### 6.6 Coverage Matrix (Plan Comparison)

1. Click **Compare Coverage** in the workspace toolbar
2. The **Coverage Matrix** displays a side-by-side grid:
   - **Rows**: Coverage levels (50% through 85%)
   - **Columns**: Plan types (RP, RP-HPE, YP)
   - **Cells**: Guarantee amount, premium, and indemnity estimate
3. Use this tool during the sales closing period to evaluate the best plan/level combination
4. The matrix uses current spring prices from the `insurance_pricing` table

### 6.7 Payout Simulator

1. Click **Simulate Payout** on any policy or from the toolbar
2. The **Payout Simulator** opens with interactive sliders:
   - **Yield Slider** — Adjust actual yield from 0% to 150% of APH
   - **Price Slider** — Adjust harvest price relative to spring price (RP only)
3. The calculator recalculates indemnity in real-time (<100ms)
4. Key outputs displayed:
   - Revenue guarantee
   - Actual revenue (yield x price)
   - Indemnity payment (if any)
   - Net position after premium
5. Use this tool to stress-test scenarios before finalizing coverage decisions

### 6.8 Yield Sync from Grain Tickets

1. Click **Sync Yields** in the workspace toolbar
2. The system pulls actual yield data from the **Grain Tickets** module
3. Yields are matched to policies by farm name and crop (using normalized name matching)
4. The `actual` field on each policy is updated
5. If actual yield falls below the effective guarantee, the **Claim Alert** flag is automatically set

### 6.9 Claim Alerts

- Policies with a yellow **Claim Alert** badge indicate actual yield is below the coverage guarantee
- This is computed automatically by `computeClaimAlert()` whenever actual yield data is synced
- When you see a claim alert, proceed to the Claims module to file a Notice of Loss

### 6.10 Generating the Insurance Summary PDF

1. Click **Export PDF** in the workspace toolbar
2. The system generates a formatted policy summary with all coverage details
3. Download or print for your records or to share with your insurance agent

---

## 7. Module 3 — Claims Lifecycle

### 7.1 Overview

The Claims module provides a Kanban-style pipeline for managing crop insurance claims from initial notice through settlement and closure. It includes deadline tracking, document management, and an immutable timeline for audit compliance.

### 7.2 The Claims Pipeline (Kanban Board)

Claims move through six stages, displayed as columns on the Kanban board:

| Stage | Description | Deadline |
|---|---|---|
| **Notice of Loss** | Initial filing with insurance company | 15 days (FCIC CCC-576 requirement) |
| **Filed** | Formal claim submitted, awaiting adjuster | 60 days for adjuster assignment |
| **Adjuster Assigned** | Adjuster assigned, field inspection pending | 30 days for appraisal completion |
| **Under Review** | Underwriter reviewing claim and documentation | 45 days for review completion |
| **Settled** | Claim approved, payment processing | 30 days to finalize |
| **Closed** | Claim complete, no further action | No deadline |

### 7.3 Creating a New Claim

1. Click **New Claim** in the Claims workspace
2. Select the **Policy** the claim is against (dropdown lists all active policies)
3. The system auto-fills from the linked policy:
   - Crop, coverage type, coverage level, effective guarantee
4. Enter the required fields:

| Field | Description |
|---|---|
| Date of Loss | When the loss event occurred |
| Description | Narrative description of the loss |

5. Click **Create** — the claim is placed in the **Notice of Loss** column
6. A 15-day deadline is automatically set from the creation date
7. A timeline entry is created: "Claim created"

### 7.4 Moving Claims Through Stages (Drag and Drop)

1. On the Kanban board, **drag a claim card** from one column to the next
2. The stage transition is saved immediately (optimistic update)
3. A new deadline is automatically calculated based on the new stage
4. A timeline entry is recorded: "Stage changed from [X] to [Y]"

**Important**: Stage transitions should follow the natural sequence. While the system allows moving claims to any stage, skipping stages may trigger compliance concerns during audit.

### 7.5 Claim Card Details

Each claim card on the Kanban board displays:
- **Crop** and policy reference
- **Deadline badge** with color-coded urgency:
  - **Green**: More than 30 days remaining
  - **Amber**: 7–30 days remaining
  - **Red**: Less than 7 days remaining
  - **Pulsing Red**: Overdue
- **Countdown text**: e.g., "14d left", "Due today", "3d overdue"

### 7.6 Claim Detail Drawer

Click any claim card to open the **Claim Drawer** with three tabs:

#### 7.6.1 Timeline Tab

- Displays a chronological feed of all events related to the claim
- Event types include:
  - `created` — Claim creation
  - `stage_changed` — Stage transitions
  - `note` — User-added notes
  - `doc_upload` — Document attachments
- **Adding a note**: Type in the note field at the bottom and click **Add Note**
- Timeline entries are **immutable** — they cannot be edited or deleted after creation (audit requirement)

#### 7.6.2 Documents Tab

- Lists all documents attached to the claim
- Each document shows: filename, file type, file size, upload date
- **Uploading a document**:
  1. Click **Upload Document** or drag-and-drop a file onto the upload area
  2. The system requests a signed upload URL from the server
  3. The file uploads directly to secure storage (no file data passes through the API)
  4. A timeline entry is automatically created: "Document uploaded: [filename]"
- **Supported files**: PDF, JPEG, PNG, TIFF, DOC/DOCX, XLS/XLSX
- Documents are stored in the private `claim-documents` storage bucket with signed-URL access

#### 7.6.3 Financials Tab

- Displays the financial summary of the claim:
  - Effective guarantee (from linked policy)
  - Coverage type and level
  - Estimated indemnity (if calculated)

### 7.7 Deadline Management

- Deadlines are automatically calculated when a claim enters a new stage
- The **Deadline Alert Banner** appears at the top of the Claims workspace when any claim has a deadline within 7 days or is overdue
- **Overriding a deadline**:
  1. Open the claim in the Claim Drawer
  2. Click the deadline date to edit
  3. Enter the new deadline date
  4. The `deadline_overridden` flag is set to true
  5. A timeline entry records the override

### 7.8 Deleting a Claim

1. Open the Claim Drawer for the target claim
2. Click **Delete Claim**
3. Confirm the deletion
4. Associated documents and timeline entries are also removed

**Caution**: Deleting a claim removes its entire audit trail. Only delete claims created in error. For claims that are denied or withdrawn, move them to the **Closed** stage instead and add a note explaining the outcome.

---

## 8. Cross-Module Workflows

### 8.1 Annual Workflow (Recommended Sequence)

| Step | Module | Action | Timing |
|---|---|---|---|
| 1 | FSA 578 | Enter/update all CLU records for the crop year | Before planting / acreage reporting deadline |
| 2 | FSA 578 | Validate and generate acreage report PDF | Before FSA filing deadline |
| 3 | Insurance | Create policies for all insured crops | Before sales closing date |
| 4 | Insurance | Use Coverage Matrix to compare plan options | During sales closing window |
| 5 | Insurance | Use Payout Simulator to stress-test scenarios | Before finalizing coverage |
| 6 | Insurance | Look up APH from CLU records | When setting up policies |
| 7 | Insurance | Sync actual yields from Grain Tickets | After harvest |
| 8 | Insurance | Review Claim Alerts | After yield sync |
| 9 | Claims | File Notice of Loss for triggered alerts | Within 72 hours of loss discovery |
| 10 | Claims | Manage claim through pipeline to closure | Ongoing per claim |

### 8.2 Data Flow Between Modules

```
Grain Tickets ──(yield data)──> Insurance (Yield Sync)
                                    │
FSA 578 (CLU Records) ──(APH)──> Insurance (APH Lookup)
                                    │
                              Insurance (Claim Alert)
                                    │
                                    ▼
                              Claims (New Claim from Policy)
```

- **Grain Tickets → Insurance**: Actual yields flow into policies via the Yield Sync function
- **FSA 578 → Insurance**: APH values are computed from CLU records and pulled into policies
- **Insurance → Claims**: Claim alerts trigger claim creation; policy data auto-fills into new claims

### 8.3 Insurance Fields on CLU Records

The following fields on CLU records in the FSA 578 module link to the Insurance module:
- **Unit Number** — Insurance unit assignment
- **APH** — Actual Production History for the field
- **Line Number** — Policy line item reference
- **Policy Number** — Linked insurance policy number

Keep these fields current to ensure accurate APH lookups and cross-module reporting.

---

## 9. Deadlines & Compliance Calendar

### 9.1 FSA Deadlines

| Deadline | Description |
|---|---|
| Acreage Reporting | Typically July 15 for spring-planted crops; check with local FSA for specific dates |
| Prevented Planting | Report within 15 days of the final planting date |

### 9.2 Insurance Deadlines

| Deadline | Description |
|---|---|
| Sales Closing | Varies by crop and county — typically March 15 for spring crops |
| Production Reporting | Due by the acreage reporting date |
| Premium Payment | As specified by your insurance provider |

### 9.3 Claims Deadlines (FCIC)

| Stage | Deadline | Consequence of Missing |
|---|---|---|
| Notice of Loss | 15 days from discovery of loss | Claim may be denied |
| Filed → Adjuster | 60 days | Escalate to insurance company |
| Adjuster → Appraisal | 30 days | Escalate to insurance company |
| Under Review | 45 days | Contact underwriter |
| Settlement | 30 days | Contact insurance company |

**The Claims module automatically tracks these deadlines and displays color-coded alerts.**

---

## 10. Troubleshooting

| Issue | Resolution |
|---|---|
| Module not visible on dashboard | Contact administrator to verify your `module_access` permissions |
| Crop not appearing in typeahead | Verify spelling; the typeahead searches the FSA crop list — use standard FSA crop names |
| APH lookup returns no data | Ensure CLU records have APH values populated in the FSA 578 module for the matching farm/crop |
| Yield sync shows no matches | Verify farm names match between Insurance policies and Grain Tickets (the system normalizes names, but significant differences may prevent matching) |
| Claim alert not triggering | Run Yield Sync first; claim alerts are computed when actual yield data is updated |
| Document upload fails | Check file size and type; ensure you have a stable internet connection for the signed-URL upload |
| Kanban drag not working | Refresh the page; the Kanban uses client-side rendering and may need a reload after extended sessions |
| PDF export blank | Ensure the browser allows pop-ups; PDF generation runs client-side and requires JavaScript enabled |
| Deadline showing incorrect date | Check if the deadline was manually overridden (`deadline_overridden` flag); deadlines auto-calculate from stage entry date |

---

## 11. Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-03-12 | W. Hughes Farms | Initial SOP — FSA 578, Insurance, and Claims modules |
