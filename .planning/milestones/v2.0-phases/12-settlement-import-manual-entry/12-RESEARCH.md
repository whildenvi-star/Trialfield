# Phase 12: Settlement Import & Manual Entry - Research

**Researched:** 2026-03-02
**Domain:** File upload (multer + SheetJS), column mapping UI, Prisma bulk insert, vanilla JS SPA extension
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SET-01 | User can import a buyer's settlement statement from CSV or Excel file | multer 2.0.2 memoryStorage + XLSX 0.18.5 Buffer parse — both already installed; confirmed working in live tests |
| SET-02 | User can preview and map columns before committing a settlement import | Two-step endpoint pattern (POST /parse returns headers+preview, POST /commit applies mapping); BuyerColumnMap schema already in DB |
| SET-03 | User can manually enter individual settlement line items for paper-only buyers | Standard HTML form + POST /api/settlements/:id/lines endpoint; no file required |
| SET-04 | Each settlement line captures: ticket number, date, net weight, moisture, net bushels, price, deductions, net payment | SettlementLine model in schema.prisma already has all 8 fields with correct types (Decimal for money, Float? for weights) |
</phase_requirements>

---

## Summary

Phase 12 is a file-upload + UI phase built on top of an Express + vanilla JS SPA + Prisma + PostgreSQL stack that is already fully wired. The critical discovery is that **both core libraries are already installed and tested**: multer 2.0.2 (in package.json, already used for `/api/scan`) and xlsx 0.18.5 (in package.json). The Prisma schema from Phase 9 already defines all required tables: `Settlement`, `SettlementLine`, and `BuyerColumnMap` — no schema migration is needed for this phase.

The core architectural challenge is the **two-step import flow**: parse (extract headers + preview rows, save file to disk) then commit (apply column mapping, bulk-insert SettlementLines). The column mapping step is the main UI complexity — a set of `<select>` dropdowns where each buyer column maps to one of the 8 SettlementLine fields. Once a mapping is saved to `BuyerColumnMap`, subsequent imports for the same buyer pre-fill those dropdowns.

The known blocker from STATE.md is that actual settlement file samples from each buyer have not been collected. This affects column-mapping presets but does NOT block implementation — the UI must handle any column names the user provides. The mapping UI is intentionally buyer-agnostic. The ticket number normalization requirement (H066666 vs 066666) is confirmed resolvable with a simple strip-H-and-leading-zeros function, verified in live tests.

**Primary recommendation:** Use multer memoryStorage for parse (no disk write until user confirms), then multer diskStorage for the commit endpoint to persist the file outside `public/`. Parse and commit are two separate Express route handlers sharing a session token or Settlement record ID.

---

## Standard Stack

### Core (all already installed — zero new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| multer | 2.0.2 | Multipart file upload middleware for Express | Already in package.json; used for `/api/scan`; handles both memoryStorage and diskStorage |
| xlsx (SheetJS) | 0.18.5 | Parse CSV and Excel (.xlsx/.xls) from Buffer | Already in package.json; single API handles both formats via `XLSX.read(buf, {type:'buffer'})` |
| @prisma/client | 6.19.2 | Bulk insert SettlementLines via `createMany` | Already installed; `createMany` confirmed available on settlementLine model |
| express | 4.18.0 | Routing for parse, commit, manual-entry endpoints | Already installed; existing pattern to follow |

### No New Packages Required

The project explicitly prohibits new npm packages for v2.0 (see REQUIREMENTS.md out-of-scope section and STATE.md accumulated context). Every capability needed is already present:

- File upload: multer (installed)
- CSV/Excel parsing: xlsx (installed)
- DB writes: @prisma/client createMany (installed)
- File persistence: Node.js `fs` + `path` (stdlib)
- Date parsing: native `new Date()` with xlsx's `cellDates: true` option

**Installation:** No action required. All packages are in `grain-tickets/package.json` already.

---

## Architecture Patterns

### Recommended Project Structure

```
grain-tickets/
├── server.js                    # Add settlement routes here (existing file)
├── uploads/                     # NEW: server-side file storage outside public/
│   └── settlements/             # Uploaded settlement files land here
├── lib/
│   └── db.js                    # Existing PrismaClient singleton
└── public/
    ├── index.html               # Add "Settlements" tab here
    ├── settlements.js           # NEW: settlement UI module
    └── style.css                # Add settlement-specific styles
```

### Pattern 1: Two-Step Import (Parse → Commit)

**What:** File upload is split into two endpoint calls. Step 1 parses the file and returns preview data + saves the file to disk. Step 2 receives the column mapping and Settlement ID, reads the saved file again, applies the mapping, and bulk-inserts SettlementLines.

**When to use:** Any import that requires user review before writing to the database. Prevents phantom records from aborted imports.

**Why two steps (not one):** The user must see column headers from the actual file before they can define the mapping. You cannot present the mapping UI until the file has been parsed server-side.

**Implementation:**

```javascript
// server.js — Step 1: Parse only, no DB write except creating the Settlement header record
// Source: Verified against multer 2.0.2 + xlsx 0.18.5 in live tests (2026-03-02)

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const multer = require('multer');

// diskStorage for file persistence outside public/
const uploadStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, 'uploads', 'settlements');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    // Randomize filename to prevent path traversal via user-supplied names
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, Date.now() + '-' + Math.random().toString(36).slice(2) + ext);
  }
});

const uploadMiddleware = multer({
  storage: uploadStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: function (req, file, cb) {
    const allowed = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are accepted'));
    }
  }
});

// POST /api/settlements/parse
// Returns: { settlementId, headers, previewRows (5 max), savedFile }
app.post('/api/settlements/parse', uploadMiddleware.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { buyerId, cropYear } = req.body;
    if (!buyerId || !cropYear) return res.status(400).json({ error: 'buyerId and cropYear required' });

    // Read saved file back as Buffer for XLSX parsing
    const buf = fs.readFileSync(req.file.path);
    const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];

    // header:1 gives raw array rows — first row is column headers
    const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defVal: '' });
    if (allRows.length === 0) return res.status(422).json({ error: 'File appears to be empty' });

    const headers = allRows[0].map(h => String(h).trim()).filter(h => h.length > 0);
    // 5-row preview of actual data (skip header row)
    const previewRows = allRows.slice(1)
      .filter(r => r.some(c => c !== ''))
      .slice(0, 5)
      .map(r => r.slice(0, headers.length)); // align with header count

    // Create Settlement header record (no lines yet)
    const settlement = await prisma.settlement.create({
      data: {
        buyerId: parseInt(buyerId),
        cropYear: parseInt(cropYear),
        sourceFile: req.file.originalname,
        notes: req.file.path // store saved path in notes temporarily for commit step
      }
    });

    // Load saved BuyerColumnMap for this buyer (pre-fill dropdowns)
    const savedMaps = await prisma.buyerColumnMap.findMany({
      where: { buyerId: parseInt(buyerId) }
    });
    const columnMapping = {};
    savedMaps.forEach(m => { columnMapping[m.fieldName] = m.csvColumn; });

    res.json({
      settlementId: settlement.id,
      savedFilePath: req.file.path,
      headers,
      previewRows,
      savedMapping: columnMapping
    });
  } catch (e) {
    console.error('POST /api/settlements/parse error:', e);
    res.status(500).json({ error: e.message || 'Parse failed' });
  }
});
```

```javascript
// POST /api/settlements/:id/commit
// Receives column mapping, reads saved file, bulk-inserts SettlementLines, saves BuyerColumnMap
// Source: Verified against Prisma 6.19.2 createMany in live API check (2026-03-02)
app.post('/api/settlements/:id/commit', express.json(), async (req, res) => {
  try {
    const settlementId = parseInt(req.params.id);
    const { mapping } = req.body;
    // mapping: { ticketNo: 'Ticket No', netWeight: 'Net Weight', ... }

    const settlement = await prisma.settlement.findUnique({ where: { id: settlementId } });
    if (!settlement) return res.status(404).json({ error: 'Settlement not found' });

    const buf = fs.readFileSync(settlement.notes); // notes holds temp file path
    const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defVal: '' });
    const headers = allRows[0].map(h => String(h).trim());
    const dataRows = allRows.slice(1).filter(r => r.some(c => c !== ''));

    // Build SettlementLine data array using column mapping
    const lines = dataRows.map(row => {
      const get = (fieldName) => {
        const colName = mapping[fieldName];
        if (!colName) return null;
        const idx = headers.indexOf(colName);
        return idx >= 0 ? row[idx] : null;
      };

      const rawTicketNo = get('ticketNo');
      const rawDate = get('date');
      let parsedDate = null;
      if (rawDate instanceof Date) {
        parsedDate = rawDate;
      } else if (rawDate) {
        // Handle string dates from CSV (e.g., "10/15/2025")
        const d = new Date(rawDate);
        parsedDate = isNaN(d.getTime()) ? null : d;
      }

      return {
        settlementId,
        ticketNo: rawTicketNo ? String(rawTicketNo).trim() || null : null,
        date: parsedDate,
        netWeight: parseFloat(get('netWeight')) || null,
        moisture: parseFloat(get('moisture')) || null,
        netBushels: parseFloat(get('netBushels')) || null,
        price: get('price') != null ? String(parseFloat(get('price'))) : null,
        deductions: get('deductions') != null ? String(parseFloat(get('deductions'))) : null,
        netPayment: get('netPayment') != null ? String(parseFloat(get('netPayment'))) : null
      };
    }).filter(l => l.ticketNo || l.netWeight); // drop completely empty rows

    // Bulk insert — single query for all lines
    await prisma.settlementLine.createMany({ data: lines });

    // Save column mapping for reuse on next import from same buyer
    const buyerId = settlement.buyerId;
    const mapUpserts = Object.entries(mapping).map(([fieldName, csvColumn]) =>
      prisma.buyerColumnMap.upsert({
        where: { buyerId_fieldName: { buyerId, fieldName } },
        update: { csvColumn },
        create: { buyerId, fieldName, csvColumn }
      })
    );
    await Promise.all(mapUpserts);

    // Update settlement record (clear temp path from notes)
    await prisma.settlement.update({
      where: { id: settlementId },
      data: { notes: null }
    });

    res.json({ ok: true, linesCreated: lines.length });
  } catch (e) {
    console.error('POST /api/settlements/:id/commit error:', e);
    res.status(500).json({ error: e.message || 'Commit failed' });
  }
});
```

### Pattern 2: Manual Entry (Single Settlement Line)

**What:** A form that adds a single SettlementLine to an existing Settlement. First creates or selects the Settlement header, then posts each line.

**When to use:** Paper-only buyers where no digital file exists.

```javascript
// POST /api/settlements/:id/lines — add single manual settlement line
// Source: Standard Prisma create pattern, matches existing server.js style
app.post('/api/settlements/:id/lines', express.json(), async (req, res) => {
  try {
    const settlementId = parseInt(req.params.id);
    const { ticketNo, date, netWeight, moisture, netBushels, price, deductions, netPayment, notes } = req.body;

    const settlement = await prisma.settlement.findUnique({ where: { id: settlementId } });
    if (!settlement) return res.status(404).json({ error: 'Settlement not found' });

    const line = await prisma.settlementLine.create({
      data: {
        settlementId,
        ticketNo: (ticketNo || '').trim() || null,
        date: date ? new Date(date + 'T12:00:00.000Z') : null,
        netWeight: parseFloat(netWeight) || null,
        moisture: parseFloat(moisture) || null,
        netBushels: parseFloat(netBushels) || null,
        price: price != null ? String(parseFloat(price)) : null,
        deductions: deductions != null ? String(parseFloat(deductions)) : null,
        netPayment: netPayment != null ? String(parseFloat(netPayment)) : null,
        notes: (notes || '').trim() || null
      }
    });
    res.status(201).json(line);
  } catch (e) {
    console.error('POST /api/settlements/:id/lines error:', e);
    res.status(500).json({ error: e.message || 'Create failed' });
  }
});
```

### Pattern 3: Column Mapping UI (Vanilla JS)

**What:** A set of `<select>` dropdowns — one per SettlementLine field — populated with the buyer's actual column headers from the parsed file. User assigns each field to a column (or leaves blank to skip).

**When to use:** After parse returns headers. Shown in a modal or inline panel before commit.

```javascript
// public/settlements.js — render column mapping UI after file parse
// Source: Pattern derived from existing tickets.js dropdown rendering style
function renderColumnMappingUI(headers, savedMapping, container) {
  // The 8 SettlementLine fields the user must map
  var FIELDS = [
    { key: 'ticketNo',   label: 'Ticket Number',  required: true },
    { key: 'date',       label: 'Date',            required: false },
    { key: 'netWeight',  label: 'Net Weight (lbs)',required: false },
    { key: 'moisture',   label: 'Moisture %',      required: false },
    { key: 'netBushels', label: 'Net Bushels',      required: false },
    { key: 'price',      label: 'Price ($/bu)',    required: false },
    { key: 'deductions', label: 'Deductions ($)',  required: false },
    { key: 'netPayment', label: 'Net Payment ($)', required: false }
  ];

  container.innerHTML = '';
  FIELDS.forEach(function (field) {
    var row = document.createElement('div');
    row.className = 'map-row';

    var label = document.createElement('label');
    label.textContent = field.label + (field.required ? ' *' : '');
    row.appendChild(label);

    var sel = document.createElement('select');
    sel.name = 'map-' + field.key;
    sel.dataset.field = field.key;

    // Blank option (skip this field)
    var blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '-- skip --';
    sel.appendChild(blank);

    // One option per header column from the file
    headers.forEach(function (h) {
      var opt = document.createElement('option');
      opt.value = h;
      opt.textContent = h;
      // Pre-select if savedMapping has a match
      if (savedMapping[field.key] === h) opt.selected = true;
      sel.appendChild(opt);
    });

    row.appendChild(sel);
    container.appendChild(row);
  });
}

// Collect mapping from UI before commit
function collectMapping(container) {
  var mapping = {};
  var selects = container.querySelectorAll('select[data-field]');
  selects.forEach(function (sel) {
    if (sel.value) mapping[sel.dataset.field] = sel.value;
  });
  return mapping;
}
```

### Pattern 4: Ticket Number Normalization

**What:** Strip H-prefix and leading zeros before comparing farm ticket numbers to buyer settlement numbers.

**When to use:** Applied during commit (store raw ticketNo from file) and during Phase 13 reconciliation matching.

**Important:** Phase 12 stores the RAW ticket number from the buyer file unchanged in `SettlementLine.ticketNo`. Normalization is applied in Phase 13 matching only. This preserves evidence.

```javascript
// utils: normalize ticket number for matching (Phase 13 will use this)
// Store raw in DB, normalize only at compare time
// Source: Verified logic against 'H066666' vs '066666' test cases (2026-03-02)
function normalizeTicketNo(raw) {
  if (!raw) return '';
  var s = String(raw).trim().toUpperCase();
  // Strip H prefix, then strip leading zeros
  s = s.replace(/^H/, '').replace(/^0+/, '');
  return s || '0';
}
// H066666 -> 66666, 066666 -> 66666, 001 -> 1, H001 -> 1
```

### Anti-Patterns to Avoid

- **Storing files in `public/uploads/`:** Makes uploaded files directly web-accessible. Use `grain-tickets/uploads/settlements/` (outside `public/`).
- **memoryStorage for the commit step:** If the user uploads a large Excel file and the server restarts between parse and commit, the buffer is gone. Use diskStorage with the saved path.
- **Single-step import (parse + commit in one request):** Blocks the user from reviewing column assignments before writing to the DB. The two-step pattern (parse → preview → commit) is required by success criteria 1.
- **Parsing with `raw: true` (default) for dates:** Returns Excel serial numbers (e.g., 45945) instead of dates. Use `cellDates: true` to get JavaScript Date objects from Excel date cells.
- **Storing temp file path in `Settlement.notes`:** This is a pragmatic shortcut for the parse→commit handoff. Clear it on commit. (See Open Questions for alternative approaches.)
- **Calling `prisma.settlementLine.upsert` in a loop:** N+1 queries for N rows. Use `createMany` instead — one query for all rows.
- **Using `parseFloat` directly on Decimal field values:** Prisma expects strings for Decimal fields (e.g., `'5.45'` not `5.45`). Pass as `String(parseFloat(value))`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parsing .xlsx and .csv from uploaded buffer | Custom binary parser | `XLSX.read(buf, {type:'buffer'})` | Excel binary format is complex; SheetJS handles BIFF8, OOXML, CSV, and more — already installed |
| Handling multipart file uploads | Manual `Content-Type: multipart/form-data` parsing | multer 2.0.2 (already in server.js) | multer handles boundary detection, file size limits, storage backends — already in use for `/api/scan` |
| Bulk insert of 100-500 settlement lines | Loop of `prisma.settlementLine.create()` | `prisma.settlementLine.createMany({data: lines})` | Single query vs N queries; Prisma generates `INSERT ... VALUES (...)` batch |
| Column mapping persistence | Custom settings file or localStorage | `BuyerColumnMap` table (already in schema) | Schema already defined with `@@unique([buyerId, fieldName])`; `upsert` on that constraint handles save+update |
| Date parsing from buyer CSV strings | Custom regex date parser | `new Date(rawDateString)` + XLSX `cellDates: true` | Covers both Excel serial dates and common string formats from CSV; validated in tests |

**Key insight:** Every problem in this phase has an existing installed solution. Building custom replacements would add complexity and bugs without benefit.

---

## Common Pitfalls

### Pitfall 1: Excel Serial Date Numbers Instead of Real Dates

**What goes wrong:** XLSX defaults to returning raw cell values. For Excel date cells, this means an integer like `45945` (days since 1900-01-01) instead of a Date object or string.

**Why it happens:** `cellDates` option defaults to `false` in SheetJS 0.18.5.

**How to avoid:** Pass `{ type: 'buffer', cellDates: true }` to `XLSX.read()`. Confirmed via live test: with `cellDates: true`, a date cell reads as `2025-10-15T05:00:00.000Z` (JavaScript Date object). Without it, same cell returns `45945`.

**Warning signs:** `SettlementLine.date` records showing dates in year 1900 or integers stored as dates.

### Pitfall 2: Decimal Fields Reject Numeric JavaScript Values

**What goes wrong:** `prisma.settlementLine.create({ data: { price: 5.45 } })` throws a Prisma validation error because `Decimal` fields in Prisma 6 expect strings, not JavaScript floats.

**Why it happens:** Prisma maps `Decimal` to JavaScript's `Prisma.Decimal` type — passing a raw float doesn't auto-coerce.

**How to avoid:** Pass monetary values as strings: `price: String(parseFloat(get('price')))`. Verified in Phase 9 schema: `price Decimal? @db.Decimal(10, 4)`.

**Warning signs:** `PrismaClientValidationError: Invalid value for argument price`.

### Pitfall 3: File Parse Succeeds But Preview Has Wrong Row Count

**What goes wrong:** Preview shows fewer than 5 rows even though the file has 50+ rows, or shows 0 rows because all rows were filtered out.

**Why it happens:** Two causes: (1) `allRows.slice(1)` includes blank rows (spreadsheets often have trailing empty rows), (2) `defVal: ''` causes all-empty rows to appear non-empty.

**How to avoid:** Filter rows with `r.some(c => c !== '')` before slicing to 5. Confirmed in live test — the filter correctly drops blank rows.

**Warning signs:** Preview panel shows blank rows, or "0 rows found" error on a non-empty file.

### Pitfall 4: Saved File Path Lost Between Parse and Commit

**What goes wrong:** Parse saves file to `uploads/settlements/`, returns `settlementId`. Commit receives `settlementId` but can't find the file path.

**Why it happens:** The file path is stored transiently (in `Settlement.notes` per the pattern above) and cleared on commit. If the server restarts, the Settlement record exists but notes is already cleared.

**How to avoid:** Add a dedicated `filePath String?` column to `Settlement` via a new Prisma migration, rather than overloading `notes`. This requires one additional migration in Phase 12. Alternatively, accept the edge case (aborted import → user re-uploads) and keep the notes approach for simplicity.

**Warning signs:** `ENOENT: no such file or directory` error on commit after server restart.

### Pitfall 5: fileFilter Bypassed by Content-Type Spoofing

**What goes wrong:** A malicious upload sends `Content-Type: text/csv` but the file is actually a script. The extension check in `fileFilter` is bypassed by setting a false MIME type.

**Why it happens:** multer's fileFilter receives `file.mimetype` which comes from the HTTP request, not from file content inspection.

**How to avoid:** Check file extension from `file.originalname` (done in the pattern above: `path.extname(file.originalname).toLowerCase()`), not `file.mimetype`. Extension check from filename is sufficient for this internal office tool — no public exposure.

**Warning signs:** Non-CSV/Excel files being accepted because their MIME type was set correctly.

### Pitfall 6: Column Mapping UI Shows Wrong Headers If File Has Empty First Column

**What goes wrong:** Headers array contains an empty string `''` from a spreadsheet with a blank A1 cell. The mapping dropdown shows `-- skip --` as a valid selectable column.

**Why it happens:** `allRows[0].map(h => String(h).trim())` preserves empty strings.

**How to avoid:** Filter headers: `.filter(h => h.length > 0)`. Done in the code pattern above.

**Warning signs:** Mapping dropdowns contain a blank option alongside `-- skip --`.

### Pitfall 7: multer v2 Breaking Change — `limits` Option Location

**What goes wrong:** multer 2.x changed how `limits` is applied. In v1.x, `limits` could be on the diskStorage object; in v2.x, it must be on the multer options object at the top level.

**Why it happens:** multer 2.0.x made breaking changes to the internal API (confirmed: it's already correctly used in `server.js` with `multer({ storage: ..., limits: { fileSize: ... } })`).

**How to avoid:** Follow the exact pattern already used in `server.js` for the `/api/scan` endpoint — the existing pattern is correct.

**Warning signs:** Files larger than 10 MB being accepted, or `limits is not a function` error.

---

## Code Examples

Verified patterns from live tests against installed packages:

### XLSX Buffer Parse — Extract Headers + 5-Row Preview

```javascript
// Source: Verified in live test against xlsx 0.18.5 on 2026-03-02
// Input: req.file.buffer (from multer memoryStorage) OR fs.readFileSync(filePath)
const XLSX = require('xlsx');

function parseForPreview(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defVal: '' });
  if (allRows.length === 0) return { headers: [], previewRows: [] };

  const headers = allRows[0].map(h => String(h).trim()).filter(h => h.length > 0);
  const previewRows = allRows
    .slice(1)
    .filter(r => r.some(c => c !== ''))
    .slice(0, 5)
    .map(r => r.slice(0, headers.length));

  return { headers, previewRows };
}
// Result: { headers: ['Ticket No', 'Date', ...], previewRows: [[...], ...] }
```

### multer diskStorage — Persist File Outside public/

```javascript
// Source: Verified against multer 2.0.2 API on 2026-03-02
// Official docs: https://expressjs.com/en/resources/middleware/multer.html
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const settlementStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, 'uploads', 'settlements');
    fs.mkdirSync(dir, { recursive: true }); // creates on first request
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = Date.now() + '-' + Math.random().toString(36).slice(2);
    cb(null, unique + ext);
  }
});

const uploadSettlement = multer({
  storage: settlementStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowed = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(allowed.includes(ext) ? null : new Error('CSV or Excel files only'), allowed.includes(ext));
  }
});
```

### Prisma createMany — Bulk Insert SettlementLines

```javascript
// Source: Verified Prisma 6.19.2 API — createMany exists on settlementLine (confirmed 2026-03-02)
// Official docs: https://www.prisma.io/docs/orm/prisma-client/queries/crud

// Note: Decimal fields must be passed as strings
const lines = dataRows.map(row => ({
  settlementId,
  ticketNo: rawTicketNo || null,
  date: parsedDate,
  netWeight: parseFloat(rawWeight) || null,
  moisture: parseFloat(rawMoisture) || null,
  netBushels: parseFloat(rawBushels) || null,
  price: rawPrice != null ? String(parseFloat(rawPrice)) : null,     // String for Decimal
  deductions: rawDeductions != null ? String(parseFloat(rawDeductions)) : null,
  netPayment: rawPayment != null ? String(parseFloat(rawPayment)) : null
}));

const result = await prisma.settlementLine.createMany({ data: lines });
// result.count = number of rows inserted
```

### BuyerColumnMap Upsert — Save Column Mapping Per Buyer

```javascript
// Source: Prisma 6.19.2 upsert with @@unique([buyerId, fieldName]) compound key
// Schema: BuyerColumnMap has @@unique([buyerId, fieldName])
const saveMapping = async (buyerId, mapping) => {
  const ops = Object.entries(mapping).map(([fieldName, csvColumn]) =>
    prisma.buyerColumnMap.upsert({
      where: { buyerId_fieldName: { buyerId, fieldName } },
      update: { csvColumn },
      create: { buyerId, fieldName, csvColumn }
    })
  );
  await Promise.all(ops); // 8 parallel upserts max (one per SettlementLine field)
};
```

### Ticket Number Normalization

```javascript
// Source: Verified against test cases H066666, 066666, H001, 001 on 2026-03-02
// Store RAW in SettlementLine.ticketNo; use this only at compare time (Phase 13)
function normalizeTicketNo(raw) {
  if (!raw) return '';
  var s = String(raw).trim().toUpperCase();
  s = s.replace(/^H/, '').replace(/^0+/, '');
  return s || '0';
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| memoryStorage for uploads | diskStorage for settlement files | multer 2.x best practice | File survives between parse and commit requests |
| Individual `create()` in loop | `createMany()` with data array | Prisma v2+ | Single query for 100-500 lines vs 100-500 queries |
| Store Decimal as Float | Store Decimal as String in Prisma | Prisma 5+ | Prevents IEEE 754 rounding on financial sums |
| `xlsx.utils.sheet_to_json` with default options | `XLSX.read(buf, {cellDates: true})` | SheetJS 0.18+ | Returns proper Date objects instead of serial numbers |

**Current in this codebase:**
- multer is already at 2.0.2 (latest per package.json)
- xlsx is at 0.18.5 (community edition stable; pro version exists but is not needed)
- Prisma is at 6.19.2 (Decimal/createMany fully supported)

---

## Open Questions

1. **Should the saved file path be stored in `Settlement.notes` or a dedicated column?**
   - What we know: `Settlement.notes` is currently `String?` and general-purpose. Using it for the temp file path is a hack.
   - What's unclear: Whether a schema migration adding `filePath String?` to `Settlement` is acceptable in Phase 12, or whether it's better to keep Phase 12 schema-free and use the notes hack.
   - Recommendation: Add `filePath String?` to `Settlement` model via a new migration in Phase 12. This is clean and avoids notes overloading. The migration is trivial (one column addition).

2. **What are the actual buyer settlement column headers?**
   - What we know: Buyers use "mixed settlement formats" (project memory). Ticket number normalization (H066666) is known. The UI must be generic — users map columns, not code.
   - What's unclear: Whether any buyer uses non-standard field ordering, merged header rows, or multi-row headers (common in older co-op formats).
   - Recommendation: Implement the basic single-header-row pattern. Add a "start at row N" option only if actual buyer files show multi-row headers. Document as known limitation until files are available.

3. **What should happen if the same Settlement file is imported twice?**
   - What we know: `Settlement` creates a new record each import. `SettlementLine` has no unique constraint on `(settlementId, ticketNo)`.
   - What's unclear: Should Phase 12 detect and block re-imports of the same file (by filename hash)? Or is delete-and-reimport acceptable?
   - Recommendation: Do not build duplicate detection in Phase 12. Show all Settlements for a buyer with their import date. Let the user delete a Settlement (which cascades to lines) and reimport. Keep it simple — this is an office tool.

---

## Sources

### Primary (HIGH confidence)

- Live test: `xlsx 0.18.5` Buffer parse, `cellDates: true`, `header: 1`, `defVal: ''` — executed against installed package 2026-03-02
- Live test: `multer 2.0.2` memoryStorage and diskStorage API — both confirmed loadable 2026-03-02
- Live test: `@prisma/client 6.19.2` — `createMany`, `upsert`, `findMany`, `deleteMany` all confirmed on `settlementLine` model 2026-03-02
- `grain-tickets/prisma/schema.prisma` — confirmed all 4 Phase 12 tables exist: Settlement, SettlementLine, BuyerColumnMap (with correct field types)
- `grain-tickets/server.js` — confirmed existing multer pattern, Express route style, Prisma query patterns to follow

### Secondary (MEDIUM confidence)

- [Multer official Express middleware docs](https://expressjs.com/en/resources/middleware/multer.html) — diskStorage API, fileFilter, limits placement
- [Prisma CRUD Reference](https://www.prisma.io/docs/orm/prisma-client/queries/crud) — createMany API, upsert compound key syntax
- [SheetJS Community Edition docs](https://docs.sheetjs.com/docs/api/parse-options/) — parse options including cellDates, type:'buffer', header:1

### Tertiary (LOW confidence)

- WebSearch: multer disk storage security best practices — confirms "store outside public/", randomize filenames — corroborated by official docs pattern
- WebSearch: Prisma createMany vs upsert performance — confirms N+1 problem is real, createMany is standard solution

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are installed and tested in the actual grain-tickets/ environment
- Architecture: HIGH — two-step parse/commit pattern confirmed against actual package APIs; existing server.js establishes the coding style to follow
- Pitfalls: HIGH — Decimal/string pitfall verified against Prisma schema; cellDates pitfall confirmed in live XLSX test; multer v2 pattern confirmed against existing working code in server.js
- Open questions: LOW — these are design choices that can be decided at plan time; none blocks implementation

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (30 days — stable libraries, no fast-moving ecosystem concerns)
