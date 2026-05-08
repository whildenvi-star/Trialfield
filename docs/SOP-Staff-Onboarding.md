# Glomalin Farm Operations Platform — Staff Onboarding SOP

**Version:** 1.0
**Effective Date:** March 2026
**Owner:** Farm Admin

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Roles & Access Levels](#2-roles--access-levels)
3. [Admin SOP: Creating & Managing Users](#3-admin-sop-creating--managing-users)
4. [Operator Instructions: Logging In](#4-operator-instructions-logging-in)
5. [Module Guide: Grain Tickets](#5-module-guide-grain-tickets)
6. [Module Guide: Farm Registry](#6-module-guide-farm-registry)
7. [Module Guide: Farm Budget](#7-module-guide-farm-budget)
8. [Module Guide: FSA Acres & Insurance](#8-module-guide-fsa-acres--insurance)
9. [Module Guide: Seed Inventory](#9-module-guide-seed-inventory)
10. [Module Guide: Meristem Malt](#10-module-guide-meristem-malt)
11. [Day/Night Theme](#11-daynight-theme)
12. [Troubleshooting](#12-troubleshooting)
13. [Quick Reference Card](#13-quick-reference-card)

---

## 1. System Overview

The Glomalin Platform is a single sign-on portal that connects all farm operation tools in one place. You log in once and get access to the modules you need based on your role.

**What the system tracks:**

| Area | Module | What It Does |
|------|--------|-------------|
| Grain | Grain Tickets | Record loads from combine to settlement |
| Planning | Farm Budget | Plan crops, inputs, seeds, orders by field |
| Compliance | FSA Acres | USDA acreage reporting & crop insurance |
| Procurement | Seed Inventory | Order, receive, and reconcile seed & inputs |
| Fields | Farm Registry | Master list of all fields and acres |
| Organic | Organic Cert | NOP compliance and audit documentation |
| Malting | Meristem Malt | Batch cost calculator for malt operations |

All data flows between modules automatically. For example, field acres in the Farm Registry feed into Grain Tickets for yield calculations, and Farm Budget forecasts feed into Seed Inventory for ordering.

---

## 2. Roles & Access Levels

| Role | Who | What They Can Do |
|------|-----|-----------------|
| **Admin** | Farm owner/manager | Full access. Create users, assign roles, grant/revoke module access. |
| **Agronomist** | Crop advisors | Read/write access to all granted farm data modules. |
| **Operator** | Truck drivers, field crew | Enter grain tickets, view field info, confirm deliveries. |
| **Viewer** | Landlords, accountants, lenders | Read-only access to granted modules. Can export CSV but cannot edit. |

**Important:** Your role sets your general permission level, but an admin must also grant you access to each specific module. You will only see modules you have been granted on your dashboard.

---

## 3. Admin SOP: Creating & Managing Users

### 3.1 — Inviting a New User

1. Log in to the portal.
2. Click **User Management** in the portal footer (admin-only link).
3. On the Admin panel, click **Invite User**.
4. Fill in:
   - **Email** — the person's email address (they'll get a signup link)
   - **Role** — select from Admin / Agronomist / Operator / Viewer
   - **Modules** — check the boxes for each module they need
5. Click **Send Invite**.
6. The new user receives an email with a link to set their password.

### 3.2 — Recommended Module Grants by Role

| Role | Recommended Modules |
|------|-------------------|
| Operator (truck driver) | Grain Tickets |
| Operator (field crew) | Grain Tickets, Farm Registry |
| Agronomist | Farm Budget, FSA Acres, Insurance, Seed Inventory, Farm Registry, Grain Tickets |
| Viewer (landlord) | Farm Registry, FSA Acres |
| Viewer (accountant) | Grain Tickets, Farm Budget |
| Admin | All modules |

### 3.3 — Changing a User's Role or Access

1. Go to the Admin panel.
2. Find the user in the table.
3. To change their role: use the **role dropdown** next to their name.
4. To grant/revoke a module: **toggle the switch** for that module.
5. Changes save immediately — no save button needed.

### 3.4 — Removing Access

To remove a user's access entirely, revoke all module toggles. There is no "delete user" — just remove all module grants and they will see an empty dashboard.

---

## 4. Operator Instructions: Logging In

### First-Time Login

1. Check your email for an invite from Glomalin.
2. Click the link and set your password (minimum 8 characters).
3. Go to the portal URL (provided by your admin).
4. Enter your **email** and **password**.
5. Click **Sign In**.

### Returning Login

1. Go to the portal URL.
2. Enter email and password.
3. Click **Sign In**.
4. You land on the **Dashboard** showing your available modules.

### Forgot Password

1. On the login screen, click **Forgot Password**.
2. Enter your email.
3. Check your inbox for a reset link.
4. Click the link, enter a new password, confirm it.
5. Log in with your new password.

### Session Timeout

If you see "Your session has expired," just log in again. Your work is saved — sessions expire after inactivity for security.

---

## 5. Module Guide: Grain Tickets

**Who uses this:** Operators, agronomists, admin
**Purpose:** Record every load of grain from field to buyer

### Entering a New Ticket

1. From the dashboard, click **Grain Tickets**.
2. Click the **New Ticket** card.
3. Fill in the form:

| Field | What to Enter | Example |
|-------|--------------|---------|
| Date | Date on the scale ticket | 09/15/2026 |
| Farm | Which farm the grain came from | Hughes Home |
| Net Weight | Weight in pounds from the scale ticket | 54,320 |
| Moisture % | Moisture reading from the ticket | 14.2 |
| Crop | What crop | Organic SRW Wheat |
| Ticket Number | Number printed on the ticket | H066842 |
| Destination | Where the load went | Bunge Logansport |
| Notes | HBT bin number, truck ID, anything else | Bin 4, Truck 2 |
| FM | Foreign material percentage (if listed) | 0.3 |

4. Check the **live preview panel** on the right — it shows calculated bushels, test weight, and any discounts.
5. Click **Submit**.

### Viewing & Filtering Tickets

1. Click **Ticket Log**.
2. Use the filters at the top:
   - **Search** — type any keyword to search all fields
   - **Farm** — filter by farm name
   - **Crop** — filter by crop type
   - **Destination** — filter by buyer
   - **Year** — filter by crop year
   - **Date range** — pick start and end dates
3. Quick presets: "This Week", "This Month", "Last 30 Days", "All"
4. Click any row to edit that ticket.
5. Click **Export CSV** to download filtered results.

### Farm Summary

Click **Farm Summary** to see yield per acre by farm and crop. This pulls acres from the Farm Registry (shown with a green **R** badge) to calculate yield/acre.

### Settlements

Settlements are handled by the agronomist or admin:

1. **Import** — Upload a settlement CSV/Excel from the buyer (co-op, elevator). Map the columns to match. Preview and commit.
2. **Reconciliation** — The system compares raw pounds on your tickets vs. the buyer's settlement. Flagged discrepancies appear in red.
3. **Season Summary** — See total paid by buyer by crop.

---

## 6. Module Guide: Farm Registry

**Who uses this:** Admin, agronomists
**Purpose:** Master list of all fields — THE source of truth for acres across the entire system

### Layout

- **Left panel:** Searchable table of all fields
- **Right panel:** Edit form for the selected field

### Viewing Fields

1. From the dashboard, click **Farm Registry**.
2. Scroll the left table or use the **search bar** to find a field.
3. Filter by **Ownership** (Rented/Owned/Mixed) or **Organic** status.
4. Click a field row to see its details on the right.

### Editing a Field (Admin/Agronomist)

1. Select a field from the left panel.
2. Edit the right panel:
   - **Field Name** — display name
   - **Reporting Acres** — THE canonical acre number used across all apps
   - **Ownership** — Rented, Owned, or Mixed
   - **Certification** — Organic, Conventional, Transitional, or Split
   - **Organic Acres** — organic-certified acres within the field
   - **Tillable Breakdown** — Rented tillable, owned tillable, non-tillable
   - **Landlord** — name and contact info
   - **Rent** — annual rent amount (rate auto-calculates)
   - **Aliases** — alternate names other people use for this field
   - **Notes** — special info (drainage, restrictions, etc.)
3. Click **Save**.

### Adding a Field

1. Click **Add Field** above the table.
2. Fill in the form on the right.
3. Click **Save**.

### Important

When you change **Reporting Acres** here, other modules pick up the change when they sync. This is the one place to update acres.

---

## 7. Module Guide: Farm Budget

**Who uses this:** Admin, agronomists
**Purpose:** Plan the crop year — fields, enterprises, inputs, seeds, orders, deliveries

### Navigation

The Farm Budget has tabs across the top:

| Tab | What It Does |
|-----|-------------|
| Dashboard | Summary of total enterprises, fields, acres |
| Fields | View and manage fields (syncs from Farm Registry) |
| Enterprises | Assign crops to fields by certification |
| Forecasts | Predicted input needs by product and field |
| Orders | Create and track purchase orders |
| Deliveries | Record received goods against orders |
| Seeds | Seed selection by field |
| Reference | Product catalog, suppliers, pricing |
| Reports | Print 5 pre-formatted reports |

### Key Workflows

**Sync fields from registry:**
1. Go to Fields tab.
2. Click **Sync from Registry**.
3. Review changes and confirm.

**Create an enterprise:**
1. Go to Enterprises tab.
2. Click **Add Enterprise**.
3. Select field, crop, certification (organic/conventional), and planned acres.
4. Save.

**Print a report:**
1. Go to Reports tab.
2. Select one of: Agronomist Order Sheet, Field Input Plan, Forecast Summary, Order Status, Delivery Receipt Log.
3. Click **Print** or use browser print (Ctrl/Cmd + P).

### Map View

Click the map icon to see fields laid out spatially (if shapefiles are uploaded in Farm Registry).

---

## 8. Module Guide: FSA Acres & Insurance

**Who uses this:** Admin, agronomists
**Purpose:** USDA acreage reporting, crop insurance management, conservation programs

### FSA Data Tab

This is where you prepare your acreage report for the FSA office.

1. Click **FSA Data** tab.
2. Review each CLU (Common Land Unit) record.
3. For each field, verify: Farm #, Tract, CLU, Crop, Acres, Plant Date, Tillage, Cover Crop.
4. Use **Sync from Macro** to pull enterprise data from Farm Budget and compare side-by-side.
5. Mark fields as **Reported** once filed with FSA.
6. Click **Reports** to generate the Acreage Reporting Summary for your FSA appointment.

### Insurance Tab

1. Click **Insurance** tab.
2. View coverage matrix showing all policies.
3. Each row shows: Farm, Crop, Coverage %, Unit, Planted Acres, APH, Guarantee, Actual Yield, Shortfall, Indemnity estimate.
4. Click **Add Policy** to enter a new insurance line.
5. Use **Grain Ticket Yield Sync** to pull actual yields from settled grain tickets.
6. Review shortfall column — red rows indicate potential claims.

### Pricing Tab

1. Click **Pricing** tab.
2. View USDA spring/fall crop prices.
3. Click **Fetch USDA Prices** to pull latest data.
4. Override prices manually if needed (toggle manual override).

### GCS Tab

Conservation program enrollments (cover crop practices, reduced tillage, no-till).

---

## 9. Module Guide: Seed Inventory

**Who uses this:** Admin, agronomists, operators (delivery verification)
**Purpose:** Track seed and input procurement from forecast to receipt

### Tabs

| Tab | What It Does |
|-----|-------------|
| Dashboard | Summary stats: products, suppliers, open orders, delivery % |
| Products | View product catalog (synced from Farm Budget) |
| Suppliers | Manage supplier contact info |
| Forecasts | View predicted needs from Farm Budget |
| Orders | Create and track purchase orders |
| Deliveries | Record received shipments |
| Returns | Track returned goods and credits |
| Reconciliation | Compare forecast vs ordered vs delivered vs on-hand |
| Verify | Mobile-friendly delivery verification wizard |

### Verifying a Delivery (Operator Workflow)

This is the most common task for field operators:

1. Open **Seed Inventory** from the dashboard.
2. Click the **Verify** tab.
3. **Step 1:** Select the supplier from the dropdown.
4. **Step 2:** Use the camera button to scan the delivery ticket, or skip to enter manually.
5. **Step 3:** Review the scanned/entered data. The system auto-matches to pending deliveries.
6. **Step 4:** Confirm the receipt. Enter your name as the verifier.
7. **Step 5:** Done. The delivery is recorded and order status updates automatically.

### Reconciliation

The Reconciliation tab shows a full picture:
- **Forecast** — what we planned to need
- **Ordered** — what we ordered
- **Delivered** — what arrived
- **Returned** — what went back
- **On Hand** — net available
- **Balance** — surplus or shortfall
- **% Delivered** — completion percentage

---

## 10. Module Guide: Meristem Malt

**Who uses this:** Admin, malt operations staff
**Purpose:** Calculate batch costs and break-even pricing for malt production

### How to Use

1. Open **Meristem Malt** from the dashboard.
2. The **dashboard header** shows 8 key metrics: Cost/Batch, Cost/Lb, Break-Even, Selling Price, Margin, etc.
3. Scroll down through sections:
   - **Batch Configuration** — Set grain type, batch size, yield %, batches per year
   - **Variable Costs** — Edit per-batch costs (labor, water, gas, etc.) — click any number to edit
   - **Fixed Annual Costs** — Edit annual costs (auto-allocated per batch)
   - **Capital Equipment** — Enter equipment cost and useful life for depreciation
   - **Commonly Forgotten Costs** — Toggle on/off items like interest, insurance, rent
4. All changes recalculate the header metrics in real time.

### What-If Scenarios

Scroll to the **What-If Scenarios** section:
1. Adjust the 3 sliders: Batches/Year, Batch Size, Selling Price/Lb.
2. See instant margin and profit calculations.
3. Compare current plan vs. 3 what-if scenarios in the comparison table.
4. Toggle between Organic and Conventional grain to compare costs.

---

## 11. Day/Night Theme

All modules have a theme toggle in the top-right corner:
- Click **[day]** for a light background (easier in bright environments).
- Click **[night]** for the dark soil theme (default, easier on eyes indoors).
- Your preference is saved and remembered next time you open the module.

---

## 12. Troubleshooting

| Problem | Solution |
|---------|----------|
| "Your session has expired" | Log in again. Your data is saved. |
| Module shows a blank page | Click **Retry**. If it persists, check with your admin — the app may be restarting. |
| Can't see a module on dashboard | Ask your admin to grant you access to that module. |
| Clicked a module and got redirected to dashboard | You don't have access to that module. Ask your admin. |
| Data looks outdated | Some cross-module data syncs on demand. Look for a **Sync** button. |
| Forgot password | Click "Forgot Password" on the login screen. Check your email. |
| CSV export is empty | Make sure you have data in the current filter view. Clear filters and try again. |
| Numbers look wrong in Grain Tickets | Check the moisture % and FM % — small changes affect bushel calculations significantly. |
| Can't edit a field in Farm Registry | Only Admin and Agronomist roles can edit. Viewers are read-only. |
| Print cuts off columns | Use landscape orientation. Or export to CSV and print from a spreadsheet. |

---

## 13. Quick Reference Card

*Print this page and post it in the office.*

### Login
- **URL:** _(your portal address)_
- **Email:** your assigned email
- **Password:** set via invite link

### After Login
- You land on the **Dashboard**
- Click any module card to open it
- Only modules you have access to are shown

### Most Common Tasks

**Enter a grain ticket:**
Dashboard → Grain Tickets → New Ticket → fill form → Submit

**Look up a ticket:**
Dashboard → Grain Tickets → Ticket Log → use search/filters

**Check yield per acre:**
Dashboard → Grain Tickets → Farm Summary

**Verify a seed delivery:**
Dashboard → Seed Inventory → Verify tab → follow 5-step wizard

**Look up field acres:**
Dashboard → Farm Registry → search field name

**Export data:**
Open any module → look for **Export CSV** button above the table

**Print a report:**
Open module → Reports tab → select report → Print

### Need Help?
- Contact your farm admin
- Check this document for step-by-step instructions

---

*End of SOP — Glomalin Farm Operations Platform v1.0*
