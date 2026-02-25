# Phase 3: Inspection Report Generation - Research

**Researched:** 2026-02-24
**Domain:** @react-pdf/renderer server-side PDF generation in Next.js App Router, report data assembly, file persistence
**Confidence:** HIGH (library installed and confirmed compatible, patterns verified against official docs and GitHub issues)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Report Structure & Sections**
- Standard NOP section order: 1. Cover Page, 2. Table of Contents, 3. Operation Overview, 4. Field List with organic status, 5. 3-Year Field History per parcel, 6. Input Application Log, 7. Harvest Log with lot numbers, 8. Mass Balance Summary
- Auto-generated table of contents with page numbers (reports can be 20+ pages)
- Full detail per operation in the 3-year field history section: date, type, products/rates, acres, source (synced/manual), approval status — tabular format
- Cover page: farm name, address, certification number, report date, crop year, farm logo (if uploaded), placeholder line for certifier/inspector name

**PDF Layout & Branding**
- US Letter size (8.5x11), portrait for text sections, landscape for wide tables (field history, application log) — automatic rotation
- Modern sans-serif font throughout (Helvetica/Arial style) — matches the app's UI
- Header on every page: farm name and report title
- Footer on every page: "Page X of Y" and generation date
- Farm logo on cover page if available, placeholder area if not

**Mass Balance Presentation**
- Per-crop, then per-lot breakdown: group by crop (Corn, Soybeans, etc.), show total harvested and total sold side-by-side under each crop, then per-lot detail
- Current crop year only — not all 3 years
- Single unit per crop (show in the unit data was recorded, typically bushels for grain) — no automatic conversions
- Harvested vs sold won't perfectly reconcile — show both numbers side-by-side cleanly. No strict reconciliation logic, no red/green pass/fail indicators.
- If a lot has no sales records, show "No sales recorded" — no warnings needed, just factual

**Generation Workflow**
- Dedicated reports page (Admin > Reports) with "Generate Inspection Report" button
- Select crop year, optionally select specific fields (default: all fields)
- Direct download — click generate, see progress indicator, PDF downloads when ready. No in-browser preview step.
- Save generated reports with history — reports page shows previously generated reports with timestamps and download links
- PDF files stored on local filesystem (e.g., /uploads/reports/), database tracks metadata (date, crop year, filename)

### Claude's Discretion
- Progress indicator design during generation
- Exact table column widths and formatting
- How to handle very long field names in table columns
- Error handling if PDF generation fails
- File naming convention for saved reports

### Deferred Ideas (OUT OF SCOPE)
- Settlement sheet import — import PDFs/images of settlement sheets, scrape/parse sale quantities to auto-populate sales records.
- Compliance analysis — flagging non-NOP-approved materials in the report.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RPT-01 | Farm manager can generate a print-ready USDA NOP inspection report as PDF | `renderToBuffer` in Next.js API route handler + `serverExternalPackages` config; POST /api/reports/generate returns PDF buffer; client triggers download via Blob URL |
| RPT-02 | Report includes operation overview, field list, and 3-year field history | Prisma queries across Farm, Field, FieldEnterprise, FieldHistory models; field history already has working query pattern from /api/fields/[id]/history; report data assembler fetches all fields in one query |
| RPT-03 | Report includes input application log and harvest log with lot numbers | MaterialUsage, HarvestEvent, CropLot models already populated by Phase 2; report data assembler joins these; manual flex table pattern handles multi-page tables |
| RPT-04 | Report includes mass balance summary (harvested vs. sold per crop/lot) | CropLot (quantityLbs) + LoadoutEvent + SaleDelivery chain already in schema; existing computeMassBalance() in lib/mass-balance.ts; group by crop then lot for display |
</phase_requirements>

---

## Summary

Phase 3 builds on a complete Phase 2 data foundation. All the data needed for the report already exists in the Prisma schema — the work is data assembly, PDF layout, file persistence, and the UI generation workflow. The primary technology is `@react-pdf/renderer` v4.3.2, which is already installed in the project.

The critical integration challenge is `renderToBuffer` in Next.js App Router route handlers. This requires adding `serverExternalPackages: ['@react-pdf/renderer']` to `next.config.ts`. With React 19 (already in use) and this config key, the pattern works reliably. The PDF is generated server-side in an API route handler, saved to `/uploads/reports/` on the local filesystem, and metadata is tracked in a new `GeneratedReport` Prisma model.

The second challenge is multi-page tables. `@ag-media/react-pdf-table` has a documented limitation: tables do not wrap correctly across pages when content overflows. For the field history and application log sections — which will routinely exceed one page — use manual flex-based table rows instead of the library. Reserve `@ag-media/react-pdf-table` for short, single-page tables (cover page summary, mass balance totals). True auto-TOC with accurate page numbers is not natively supported by react-pdf; use bookmarks (PDF navigation) instead and format the TOC page as a static layout with section names (acceptable for inspection report use case).

**Primary recommendation:** Build the PDF in a Next.js App Router API route using `renderToBuffer` with `serverExternalPackages` config. Use manual flex rows for all multi-page tables. Store files at `process.cwd()/uploads/reports/`. Track history in a `GeneratedReport` Prisma model.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @react-pdf/renderer | 4.3.2 (installed) | PDF document creation — pages, text, images, styling | Only mature React-native PDF generation library; server-side `renderToBuffer` produces a Buffer directly usable in Next.js response |
| @ag-media/react-pdf-table | 2.0.3 (needs install) | Declarative table components for short tables | Reduces boilerplate for simple tables; limited to single-page use |
| Prisma 6 | 6.x (installed) | Data assembly queries | Already in use; aggregates harvest/sales for mass balance |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | 4.x (installed) | Date formatting in PDF content | Format dates for all report sections |
| node:fs/promises | Node built-in | Write PDF file to local filesystem | Persisting generated PDF to /uploads/reports/ |
| node:path | Node built-in | Safe path construction for file writes | Join process.cwd() with uploads path |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @react-pdf/renderer server-side | Puppeteer/headless Chrome | Much heavier, requires Chrome binary, more complex deploy; react-pdf is sufficient for structured reports |
| Manual flex tables | @ag-media/react-pdf-table | ag-media is simpler for single-page tables but breaks on multi-page; manual flex rows are required for history/application tables |
| Local filesystem | S3 / object storage | Not needed for local-first farm app; local is simpler and appropriate |

**Installation:**
```bash
npm install @ag-media/react-pdf-table
```
(Note: `@react-pdf/renderer` is already installed at 4.3.2)

---

## Architecture Patterns

### Recommended Project Structure
```
organic-cert/
├── next.config.ts                    # add serverExternalPackages
├── uploads/
│   └── reports/                      # generated PDF files (gitignored)
├── prisma/
│   └── schema.prisma                 # add GeneratedReport model
└── src/
    ├── app/
    │   ├── (app)/reports/
    │   │   └── page.tsx              # replace placeholder with full UI
    │   └── api/reports/
    │       ├── generate/
    │       │   └── route.ts          # POST: assemble data, render PDF, save, return metadata
    │       ├── [id]/
    │       │   └── route.ts          # GET: download a saved report by id
    │       └── route.ts              # GET: list all generated reports
    └── lib/
        ├── pdf/
        │   ├── inspection-report.tsx # top-level Document component
        │   ├── sections/
        │   │   ├── cover-page.tsx
        │   │   ├── toc-page.tsx
        │   │   ├── operation-overview.tsx
        │   │   ├── field-list.tsx
        │   │   ├── field-history.tsx  # uses manual flex table rows
        │   │   ├── application-log.tsx
        │   │   ├── harvest-log.tsx
        │   │   └── mass-balance.tsx
        │   ├── components/
        │   │   ├── page-header.tsx    # fixed header with farm name + title
        │   │   ├── page-footer.tsx    # fixed footer with page numbers
        │   │   └── table-row.tsx      # reusable manual flex table row
        │   └── styles.ts              # shared StyleSheet.create() definitions
        └── report-assembler.ts        # Prisma queries → ReportData shape
```

### Pattern 1: Server-Side PDF Generation in App Router

**What:** Generate PDF in a Next.js App Router route handler using `renderToBuffer`, save to filesystem, return metadata.
**When to use:** Any PDF generation triggered by user action; avoids client-side rendering complexity and font loading issues.

**Required config change (`next.config.ts`):**
```typescript
// Source: https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
```

**API route handler (`src/app/api/reports/generate/route.ts`):**
```typescript
// Source: react-pdf official docs + GitHub issue #3074 resolution pattern
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assembleReportData } from "@/lib/report-assembler";
import { InspectionReport } from "@/lib/pdf/inspection-report";
import fs from "node:fs/promises";
import path from "node:path";

export async function POST(request: Request) {
  const session = await auth();
  const user = session?.user as { farmId?: string } | undefined;
  if (!session || !user?.farmId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { cropYear, fieldIds } = body; // fieldIds optional; null = all fields

  const reportData = await assembleReportData(user.farmId, cropYear, fieldIds);

  const buffer = await renderToBuffer(
    <InspectionReport data={reportData} />
  );

  // Save to local filesystem
  const uploadsDir = path.join(process.cwd(), "uploads", "reports");
  await fs.mkdir(uploadsDir, { recursive: true });
  const filename = `inspection-${cropYear}-${Date.now()}.pdf`;
  const filePath = path.join(uploadsDir, filename);
  await fs.writeFile(filePath, buffer);

  // Persist metadata
  const report = await prisma.generatedReport.create({
    data: {
      farmId: user.farmId,
      cropYear,
      filename,
      filePath,
      fieldCount: reportData.fields.length,
    },
  });

  return NextResponse.json({ id: report.id, filename, cropYear }, { status: 201 });
}
```

### Pattern 2: Fixed Page Header and Footer

**What:** `fixed` prop renders a View on every page; `render` prop provides `pageNumber` and `totalPages`.
**When to use:** Persistent header/footer required on all pages.

```typescript
// Source: https://react-pdf.org/advanced
import { View, Text } from "@react-pdf/renderer";

// In any Page component:
<View fixed style={styles.header}>
  <Text style={styles.headerFarmName}>{data.farm.name}</Text>
  <Text style={styles.headerTitle}>USDA NOP Inspection Report – {data.cropYear}</Text>
</View>

<View fixed style={styles.footer}>
  <Text render={({ pageNumber, totalPages }) =>
    `Page ${pageNumber} of ${totalPages}`
  } />
  <Text>Generated: {generatedDate}</Text>
</View>
```

### Pattern 3: Manual Flex Table Rows (Multi-Page Safe)

**What:** Build tables from View + flex rows rather than `@ag-media/react-pdf-table`. Each row is a flex row with fixed-width cells. Pages wrap naturally.
**When to use:** Any table that can span more than one page (field history, application log, harvest log).

```typescript
// Source: react-pdf styling docs + community pattern for multi-page tables
import { View, Text, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#2d5a27",
    padding: "4 8",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    padding: "3 8",
  },
  col: (width: string) => ({ width, fontSize: 8 }),
  headerCol: (width: string) => ({ width, fontSize: 8, color: "white", fontWeight: "bold" }),
});

// Table header (repeat via wrap={false} on header row — use break prop to repeat on new page)
<View style={styles.tableHeader} wrap={false}>
  <Text style={styles.headerCol("15%")}>Date</Text>
  <Text style={styles.headerCol("20%")}>Field</Text>
  <Text style={styles.headerCol("20%")}>Operation</Text>
  <Text style={styles.headerCol("25%")}>Product / Rate</Text>
  <Text style={styles.headerCol("10%")}>Acres</Text>
  <Text style={styles.headerCol("10%")}>Source</Text>
</View>

// Rows wrap naturally across pages
{operations.map((op) => (
  <View key={op.id} style={styles.tableRow} wrap={false}>
    <Text style={styles.col("15%")}>{format(op.date, "MM/dd/yyyy")}</Text>
    <Text style={styles.col("20%")}>{op.fieldName}</Text>
    <Text style={styles.col("20%")}>{op.type}</Text>
    <Text style={styles.col("25%")}>{op.product}</Text>
    <Text style={styles.col("10%")}>{op.acres}</Text>
    <Text style={styles.col("10%")}>{op.dataSource === "SYNCED" ? "Sync" : "Manual"}</Text>
  </View>
))}
```

### Pattern 4: Per-Page Orientation (Portrait / Landscape Mix)

**What:** Each `<Page>` component has its own `orientation` prop. Landscape pages render the same fixed header/footer — they just have more horizontal space.
**When to use:** Wide tables (field history, application log) use landscape; text sections use portrait.

```typescript
// Source: https://react-pdf.org/components
<Document>
  <Page size="LETTER" orientation="portrait" style={styles.page}>
    {/* Cover, TOC, Overview, Field List, Mass Balance */}
  </Page>
  <Page size="LETTER" orientation="landscape" style={styles.page}>
    {/* Field History table — landscape for column room */}
  </Page>
  <Page size="LETTER" orientation="landscape" style={styles.page}>
    {/* Application Log */}
  </Page>
  <Page size="LETTER" orientation="portrait" style={styles.page}>
    {/* Harvest Log */}
  </Page>
</Document>
```

### Pattern 5: Client-Side Download Trigger

**What:** Client POSTs to generate, then fetches the download URL and triggers browser download.
**When to use:** Direct-download workflow without in-browser preview.

```typescript
// In reports page client component
async function handleGenerate() {
  setGenerating(true);
  try {
    const res = await fetch("/api/reports/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cropYear: selectedYear, fieldIds: selectedFieldIds }),
    });
    const { id } = await res.json();
    // Trigger download
    window.location.href = `/api/reports/${id}`;
    await refreshReportHistory();
  } finally {
    setGenerating(false);
  }
}
```

### Pattern 6: Report Data Assembly

**What:** Single server-side function that assembles all report data from Prisma into a typed `ReportData` shape before passing to the PDF renderer.
**When to use:** Keeps PDF components pure (no async); all data is pre-fetched.

```typescript
// src/lib/report-assembler.ts
export interface ReportData {
  farm: Farm;
  cropYear: number;
  generatedAt: Date;
  fields: FieldWithHistory[];         // includes 3-year history per field
  allApplications: ApplicationRecord[]; // flattened across all fields
  allHarvests: HarvestRecord[];         // with lot numbers
  massBalance: MassBalanceByCrop[];    // grouped by crop then lot
}

export async function assembleReportData(
  farmId: string,
  cropYear: number,
  fieldIds: string[] | null
): Promise<ReportData> {
  const years = [cropYear, cropYear - 1, cropYear - 2];
  // Single Prisma query joining all needed data
  const farm = await prisma.farm.findUnique({
    where: { id: farmId },
    include: {
      fields: {
        where: fieldIds ? { id: { in: fieldIds } } : undefined,
        include: {
          enterprises: {
            where: { cropYear: { in: years } },
            include: {
              materialUsages: { include: { material: true } },
              fieldOperations: { include: { equipment: true } },
              harvestEvents: {
                include: { cropLots: { include: { loadoutEvents: { include: { saleDelivery: { include: { buyer: true } } } } } } }
              },
              fertilityEvents: true,
            },
          },
          history: { where: { year: { in: years } } },
        },
      },
    },
  });
  // ... transform to ReportData shape
}
```

### Anti-Patterns to Avoid

- **Using `PDFDownloadLink` or `usePDF`:** These are browser-only; they cannot be used in server components or API routes. Always use `renderToBuffer` in an API route handler.
- **Using `@ag-media/react-pdf-table` for multi-page tables:** The library breaks on page wrapping. Tables with more than ~15-20 rows must use manual flex row patterns.
- **Calling `renderToBuffer` without `serverExternalPackages` config:** This causes `TypeError: PDFDocument is not a constructor` in Next.js App Router. The config key is mandatory.
- **Importing react-pdf in Server Components:** Import only in API routes (`route.ts`). Client page components should not import `@react-pdf/renderer`.
- **Absolute filesystem paths hardcoded:** Always use `path.join(process.cwd(), "uploads", "reports")` — never hardcode `/Users/...` or assume working directory.
- **Returning the PDF buffer directly in the response and also trying to save it:** Buffer the `renderToBuffer` result once, then use the same buffer for both `fs.writeFile` and the response (or just return metadata and serve from file).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF layout/rendering | Custom HTML-to-PDF pipeline | `@react-pdf/renderer` + `renderToBuffer` | react-pdf handles font embedding, page breaks, image inclusion, cross-platform consistency |
| Mass balance calculation | Custom reconciliation math | Existing `computeMassBalance()` in `lib/mass-balance.ts` | Already handles discrepancy math; just extend for crop/lot grouping |
| Date formatting | Manual date string manipulation | `date-fns` `format()` (already installed) | Handles timezone-safe formatting consistently |
| File cleanup / rotation | Background job | None needed in Phase 3 | Simple local store; cleanup deferred to v2 if needed |

**Key insight:** The PDF is structural data layout, not HTML. Don't try to render HTML and convert it — react-pdf's component model directly produces PDF primitives, which is far more reliable for print-precise output.

---

## Common Pitfalls

### Pitfall 1: renderToBuffer Fails with "PDFDocument is not a constructor"
**What goes wrong:** API route throws `TypeError: PDFDocument is not a constructor` when `renderToBuffer` is called.
**Why it happens:** Next.js App Router bundles server-side packages through its own module resolver which strips internal React APIs that `@react-pdf/reconciler` depends on.
**How to avoid:** Add `serverExternalPackages: ["@react-pdf/renderer"]` to `next.config.ts`. This tells Next.js to use native Node require() for the package instead of bundling it.
**Warning signs:** Error appears only in production build or when dev server restarts; works in pages router but not app router.

### Pitfall 2: Multi-Page Table Rows Get Cut Off Mid-Row
**What goes wrong:** When using `@ag-media/react-pdf-table` or any flex-based table without `wrap={false}` on rows, content is cut off at page breaks, with half a row on one page and half on the next.
**Why it happens:** react-pdf's wrapping engine breaks at any point unless individual elements opt out with `wrap={false}`.
**How to avoid:** Add `wrap={false}` to every data row View. Each row becomes atomic — if it doesn't fit on the current page, the entire row moves to the next page. For very long cell content, truncate with a fixed maxLines style.
**Warning signs:** Test with a dataset that fills 1.5 pages; visual inspection will show the break point.

### Pitfall 3: Farm Logo Fails to Render
**What goes wrong:** `<Image src={farm.logoPath} />` throws or renders blank.
**Why it happens:** In server-side rendering, the path must be an absolute filesystem path (not a URL starting with `/`). If the logo path stored in the database is relative or URL-based, it won't resolve.
**How to avoid:** Store logo paths as absolute paths OR construct them as `path.join(process.cwd(), "public", "logo.png")`. Wrap in a conditional: if no logo path, render a placeholder `<View>` with the farm name in text.
**Warning signs:** PDF generates without error but logo is blank.

### Pitfall 4: TOC Page Numbers Don't Reflect Reality
**What goes wrong:** A manually authored TOC page says "Field History: page 4" but the actual field history is on page 6 because earlier sections grew.
**Why it happens:** react-pdf has no native auto-TOC. Page numbers can only be dynamically determined at render time for the `fixed` render prop, not for arbitrary bookmarks.
**How to avoid:** Do not promise precise page numbers in the TOC. Use the TOC as a section guide (list section names and page numbers at render time by passing section start pages from a two-pass render), OR use PDF bookmarks only (react-pdf `<Bookmark>` element). For the simplest correct implementation, render the TOC as a static section listing without page numbers, relying on bookmarks for navigation.
**Warning signs:** TOC page numbers are wrong after any section content changes.

### Pitfall 5: Landscape Pages Have Wrong Margin/Header Layout
**What goes wrong:** The fixed header and footer rendered on portrait pages has wrong dimensions on landscape pages.
**Why it happens:** The header/footer style has absolute positioning or fixed widths calculated for portrait (8.5" x 11"). On landscape (11" x 8.5"), those dimensions are wrong.
**How to avoid:** Use percentage-based widths for header/footer elements or define separate portrait and landscape page wrapper components with their own header/footer styles. Test landscape pages explicitly during development.
**Warning signs:** Header text overflows or footer appears mid-page on landscape sections.

### Pitfall 6: Large Report Timeout
**What goes wrong:** For a farm with many fields (50+) and 3 years of history, `renderToBuffer` takes more than 10 seconds and the request times out.
**Why it happens:** react-pdf renders synchronously in memory; large documents with many pages are CPU-bound.
**How to avoid:** Next.js default request timeout is 60s — sufficient for most cases. Optimize Prisma query to fetch all data in one round trip (single nested include query, not N+1). If field selection is available, ensure the UI defaults to "generate report" only for selected fields. For a typical farm operation (10-30 fields), generation time should be under 10s.
**Warning signs:** Request times out in development; slow Prisma queries visible in console.

---

## Code Examples

Verified patterns from official sources:

### Page with Fixed Header and Footer
```typescript
// Source: https://react-pdf.org/advanced
import { Page, View, Text, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 40, paddingHorizontal: 30, fontSize: 10 },
  header: {
    position: "absolute",
    top: 10, left: 30, right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#2d5a27",
    paddingBottom: 4,
  },
  footer: {
    position: "absolute",
    bottom: 10, left: 30, right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

export function ReportPage({
  children,
  farmName,
  reportTitle,
  generatedDate,
  orientation = "portrait",
}: PageProps) {
  return (
    <Page size="LETTER" orientation={orientation} style={styles.page}>
      <View fixed style={styles.header}>
        <Text style={{ fontWeight: "bold" }}>{farmName}</Text>
        <Text>{reportTitle}</Text>
      </View>
      <View fixed style={styles.footer}>
        <Text>{generatedDate}</Text>
        <Text render={({ pageNumber, totalPages }) =>
          `Page ${pageNumber} of ${totalPages}`
        } />
      </View>
      {children}
    </Page>
  );
}
```

### Mass Balance Data Query
```typescript
// Extends existing computeMassBalance() in lib/mass-balance.ts
// Source: Prisma schema — CropLot → LoadoutEvent → SaleDelivery chain
const cropLotsWithSales = await prisma.cropLot.findMany({
  where: {
    fieldEnterprise: {
      field: { farmId },
      cropYear,
    },
  },
  include: {
    loadoutEvents: {
      include: {
        saleDelivery: true,
      },
    },
    harvestEvent: true,
  },
  orderBy: [{ crop: "asc" }, { lotNumber: "asc" }],
});

// Group by crop, compute totals
const byCrop = cropLotsWithSales.reduce((acc, lot) => {
  if (!acc[lot.crop]) acc[lot.crop] = [];
  const soldLbs = lot.loadoutEvents.reduce(
    (sum, le) => sum + (le.saleDelivery?.quantityLbs ?? 0),
    0
  );
  acc[lot.crop].push({
    lotNumber: lot.lotNumber,
    harvestedLbs: lot.quantityLbs,
    soldLbs,
    hasSales: lot.loadoutEvents.some((le) => le.saleDelivery),
  });
  return acc;
}, {} as Record<string, LotMassBalance[]>);
```

### GeneratedReport Prisma Model
```prisma
// Add to prisma/schema.prisma
model GeneratedReport {
  id          String   @id @default(cuid())
  farmId      String
  cropYear    Int
  filename    String
  filePath    String   // absolute path on server filesystem
  fieldCount  Int      @default(0)
  createdAt   DateTime @default(now())

  @@index([farmId, cropYear])
}
```

### Download Route (serve saved PDF)
```typescript
// src/app/api/reports/[id]/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import fs from "node:fs/promises";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const user = session?.user as { farmId?: string } | undefined;
  if (!session || !user?.farmId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const report = await prisma.generatedReport.findUnique({ where: { id } });

  if (!report || report.farmId !== user.farmId) {
    return new NextResponse("Not found", { status: 404 });
  }

  const buffer = await fs.readFile(report.filePath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${report.filename}"`,
    },
  });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `experimental.serverComponentsExternalPackages` | `serverExternalPackages` (stable) | Next.js 15 | Config key moved out of experimental; use the stable key in next.config.ts |
| `PDFDownloadLink` for generation | `renderToBuffer` in API route | react-pdf v2+ | Server-side generation is more reliable, avoids client font loading, enables file persistence |
| `renderToStream` | `renderToBuffer` | react-pdf v3+ | `renderToBuffer` returns a Promise<Buffer> — simpler to use in async Next.js route handlers |

**Deprecated/outdated:**
- `@react-pdf/renderer` < v4: React 19 support was added in v4.1.0; always use v4+.
- `experimental.serverComponentsExternalPackages`: Moved to stable `serverExternalPackages` in Next.js 15. The project uses Next.js 16; use the stable key.

---

## Open Questions

1. **TOC Auto Page Numbers**
   - What we know: react-pdf has no native auto-TOC with accurate page numbers for arbitrary sections. The `render` prop only exposes `pageNumber`/`totalPages` in `<Text>` and `<View>` elements, not the page number of a specific section.
   - What's unclear: Whether the user actually needs exact page numbers (e.g., "Field History: p. 8") or just section navigation.
   - Recommendation: Implement a static TOC that lists section names without page numbers (inspectors use PDF bookmarks to navigate). This is the safest implementation that cannot show incorrect numbers. If exact numbers are required, a two-pass rendering approach is needed (first pass to measure, second to inject — complex and fragile).

2. **Farm Logo Storage Path**
   - What we know: The `Farm` model has no `logoPath` field. The Cover Page decision says "farm logo if uploaded."
   - What's unclear: Is logo upload infrastructure planned elsewhere, or does Phase 3 need to add it?
   - Recommendation: Phase 3 should add `logoPath String?` to the Farm model and a simple logo upload endpoint (`PUT /api/farm/logo`). The Cover Page renders the logo from `path.join(process.cwd(), farm.logoPath)` or renders a text-only header if null. Keep the upload minimal — just a filesystem write and DB update.

3. **`uploads/` Directory Gitignore**
   - What we know: The user decided to store PDFs at `/uploads/reports/` on local filesystem.
   - What's unclear: Whether `uploads/` exists and is gitignored.
   - Recommendation: Create `uploads/reports/.gitkeep` and add `uploads/` to `.gitignore`. Use `fs.mkdir(..., { recursive: true })` in the generate route to ensure directory exists at runtime.

---

## Sources

### Primary (HIGH confidence)
- https://react-pdf.org/components — Page orientation prop, Image src prop, Document props
- https://react-pdf.org/advanced — fixed prop, render prop with pageNumber/totalPages, break prop
- https://react-pdf.org/styling — StyleSheet.create API, supported CSS properties, flexbox
- https://react-pdf.org/compatibility — Next.js compatibility, configuration workarounds
- https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages — stable config key (Next.js 15+)
- https://www.npmjs.com/package/@ag-media/react-pdf-table — v2.0.3 version confirmed, multi-page limitation documented
- Prisma schema in `/organic-cert/prisma/schema.prisma` — all data models confirmed
- `/organic-cert/src/lib/mass-balance.ts` — existing computeMassBalance() function
- `/organic-cert/package.json` — @react-pdf/renderer 4.3.2 confirmed installed

### Secondary (MEDIUM confidence)
- https://github.com/diegomura/react-pdf/issues/3074 — renderToBuffer Next.js 15 fix confirmed: React 19 + serverExternalPackages resolves the issue
- https://github.com/ag-media/react-pdf-table — multi-page wrapping limitation confirmed in README ("page wrapping may happen in unexpected ways")
- https://github.com/diegomura/react-pdf/issues/1493 — TOC auto page numbers: no native solution, use bookmarks instead

### Tertiary (LOW confidence)
- Community patterns for two-pass TOC rendering — not verified with official docs; flagged as complex/fragile approach to avoid

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — @react-pdf/renderer installed and version confirmed; @ag-media/react-pdf-table version confirmed via npm; all Prisma models verified in schema
- Architecture: HIGH — Next.js serverExternalPackages config verified against official docs; renderToBuffer pattern verified against GitHub issue resolutions; file patterns are standard Node.js fs
- Pitfalls: HIGH — multi-page table limitation directly stated in library README; renderToBuffer error documented in official GitHub issues with confirmed resolution

**Research date:** 2026-02-24
**Valid until:** 2026-09-24 (stable libraries; react-pdf and Next.js move slowly for these specific APIs)
