# Phase 8: Fallow Enterprise Edit Fix - Research

**Researched:** 2026-03-01
**Domain:** React state management / TypeScript interface / form pre-fill bug
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Cost field display on edit**
- Cost fields (amount + category) always visible in the fallow enterprise edit form — no collapsible sections
- Pre-fill from stored data when opening edit form (core fix)
- Editable inline — regular form fields, consistent with create flow
- No visual distinction between fallow and regular enterprise edit forms — fallow is just another enterprise
- Null cost amounts default to $0.00 in the form (never show blank)

**Save feedback behavior**
- Normal save confirmation toast — no special cost-data messaging
- If user clears cost amount, save as $0.00 (not null) — always keep a numeric value
- Save returns to enterprise list (not stay in edit form)
- On error, preserve form state with all user changes intact — no data loss on failure

**Cost field validation**
- Numeric only, no negative values
- Two decimal places allowed (standard currency: $1,234.56)
- No upper limit — user knows their costs
- Cost category field always optional (never required, even when amount > 0)

**Fallow enterprise context**
- Fallow acres are ~20-30 acres/year out of total enterprise — small but real
- Fallow still carries real costs: rent, machinery cost, interest, overhead
- Fallow just zeroes out seed, inputs, yield, crop insurance
- Both create-new and edit-existing are real workflows for fallow enterprises
- Cost amount is updated each season (rent adjustments, etc.) — pre-fill is critical

### Claude's Discretion
- Exact form field placement relative to other enterprise fields
- Error toast wording
- Currency formatting implementation details

### Deferred Ideas (OUT OF SCOPE)
- Fallow as crop type instead of toggle — remove isFallow flag, treat fallow as just another crop value. Simplifies the model but requires schema migration. Future phase.
- Itemized cost breakdown per enterprise — separate fields for rent, machinery, interest, overhead instead of single lump sum. Future phase.
- Cost/overhead fields on ALL enterprise types — every acre carries costs (rent, machinery, interest, overhead), not just fallow. Future phase.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCHEMA-03 | An enterprise can be typed as fallow/idle with optional overhead cost fields (cost amount, cost category, notes) | Schema already has `fallowCostAmount Float?` and `fallowCostCategory String?` on `FieldEnterprise`. The TypeScript interface in the page component does NOT include these fields — that is the root cause of INT-01. Fix: add both fields to the interface. |
| VIEW-05 | Enterprise creation form supports adding multiple enterprises to the same field and crop year | The form dialog handles both create and edit. The edit path (`openEdit`) hard-codes `fallowCostAmount: ""` and `fallowCostCategory: ""` instead of reading from the enterprise record. Fix: pre-fill from `ent.fallowCostAmount` and `ent.fallowCostCategory`. |
</phase_requirements>

---

## Summary

This is a pure client-side UI bug — two lines of code reset fallow cost fields to empty strings when `openEdit()` is called instead of pre-filling from the stored record. The Prisma schema, the API routes (GET list, GET single, PUT), and the save logic are all correct. No schema migration, no API changes, and no new dependencies are needed.

The root cause is a two-part problem: (1) the `FieldEnterprise` TypeScript interface in the page component omits `fallowCostAmount` and `fallowCostCategory`, so TypeScript cannot enforce they be read from `ent`; (2) `openEdit()` initializes those form fields to `""` unconditionally instead of pulling the stored values.

The complete fix is contained in one file: `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/app/(app)/field-enterprises/page.tsx`. The changes are: extend the interface, update `openEdit()` to pre-fill cost fields, and adjust the save serialization so a cleared amount saves as `0` not `null` (per locked decision).

**Primary recommendation:** Fix the TypeScript interface and `openEdit()` pre-fill in `page.tsx`. No other files need modification.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (useState) | 19 (existing) | Local form state | Already in use — all form state lives in `form` object via `useState` |
| Next.js App Router | 16 (existing) | Page component | Project is on Next.js 16; this is a `"use client"` page |
| Sonner | existing | Toast notifications | Already imported; `toast.error`, `toast.success`, `toast.warning` all present |
| shadcn/ui Input | existing | Form input fields | Already used for all text/number inputs in the dialog |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TypeScript | existing | Static typing | Interface must be extended to include the two missing fields |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline form state (useState) | React Hook Form | No justification — project pattern is plain useState objects; adding RHF for one bug fix adds unnecessary complexity |
| Controlled Input with string state | Controlled Input with number state | Keep strings: the existing pattern throughout the form uses string form fields and parses on save — stay consistent |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Existing Form Pattern (must be followed)

The page uses a single `form` state object of type with all string fields (even numeric ones), parsing to numbers only at save time:

```typescript
const [form, setForm] = useState({
  fieldId: "",
  cropYear: new Date().getFullYear().toString(),
  crop: "",
  variety: "",
  plantedAcres: "",
  organicStatus: "ORGANIC",
  label: "",
  isFallow: false,
  fallowCostAmount: "",    // string — parsed to float at save
  fallowCostCategory: "",
});
```

All `setForm` calls spread `...form` and override individual keys — this pattern must continue unchanged.

### Current openEdit() — The Bug

```typescript
// CURRENT (BROKEN) — lines 138-152
function openEdit(ent: FieldEnterprise) {
  setEditing(ent);
  setForm({
    fieldId: ent.field.id,
    cropYear: ent.cropYear.toString(),
    crop: ent.isFallow ? "" : ent.crop,
    variety: ent.variety || "",
    plantedAcres: ent.plantedAcres.toString(),
    organicStatus: ent.organicStatus,
    label: ent.label || "",
    isFallow: ent.isFallow,
    fallowCostAmount: "",         // BUG: always resets, loses stored value
    fallowCostCategory: "",       // BUG: always resets, loses stored value
  });
  setDialogOpen(true);
}
```

The interface also has no `fallowCostAmount`/`fallowCostCategory` keys, so TypeScript cannot flag this:

```typescript
// CURRENT (INCOMPLETE) — lines 35-47
interface FieldEnterprise {
  id: string;
  cropYear: number;
  crop: string;
  variety: string | null;
  label: string | null;
  isFallow: boolean;
  plantedAcres: number;
  lotNumber: string | null;
  organicStatus: string;
  locked: boolean;
  field: { id: string; name: string };
  // fallowCostAmount and fallowCostCategory are MISSING
}
```

### Fixed Pattern

**Step 1 — Extend the interface:**

```typescript
interface FieldEnterprise {
  id: string;
  cropYear: number;
  crop: string;
  variety: string | null;
  label: string | null;
  isFallow: boolean;
  fallowCostAmount: number | null;    // ADD
  fallowCostCategory: string | null;  // ADD
  plantedAcres: number;
  lotNumber: string | null;
  organicStatus: string;
  locked: boolean;
  field: { id: string; name: string };
}
```

**Step 2 — Fix openEdit() pre-fill:**

Per locked decision "Null cost amounts default to $0.00 in the form (never show blank)":

```typescript
function openEdit(ent: FieldEnterprise) {
  setEditing(ent);
  setForm({
    fieldId: ent.field.id,
    cropYear: ent.cropYear.toString(),
    crop: ent.isFallow ? "" : ent.crop,
    variety: ent.variety || "",
    plantedAcres: ent.plantedAcres.toString(),
    organicStatus: ent.organicStatus,
    label: ent.label || "",
    isFallow: ent.isFallow,
    fallowCostAmount: ent.fallowCostAmount != null
      ? ent.fallowCostAmount.toString()
      : "0",                                          // null → "0", matches $0.00 default
    fallowCostCategory: ent.fallowCostCategory || "",
  });
  setDialogOpen(true);
}
```

**Step 3 — Save serialization (already correct, verify)**

The existing `handleSave` logic:
```typescript
if (form.isFallow) {
  body.fallowCostAmount = parseFloat(form.fallowCostAmount) || null;
  body.fallowCostCategory = form.fallowCostCategory || null;
}
```

Per locked decision "If user clears cost amount, save as $0.00 (not null)": `parseFloat("") || null` evaluates to `null` when empty, which violates the decision. This must change to:

```typescript
if (form.isFallow) {
  body.fallowCostAmount = parseFloat(form.fallowCostAmount) || 0;  // empty → 0
  body.fallowCostCategory = form.fallowCostCategory || null;
}
```

Note: `parseFloat("0") || 0` = `0`, `parseFloat("") || 0` = `0`, `parseFloat("125.50") || 0` = `125.5`. This satisfies the "always keep a numeric value" requirement.

### Anti-Patterns to Avoid

- **Do not add `min="0"` HTML attribute as sole validation** — while the locked decision says "no negative values," the Input component accepts HTML attributes but the UX decision says no upper limit and two decimals are fine. A `min="0"` plus `step="0.01"` on the existing Input is correct and already present.
- **Do not null-check `ent.fallowCostAmount` with `||`** — `ent.fallowCostAmount || ""` would convert `0` to `""` (falsy). Use `!= null` ternary instead.
- **Do not split into separate fallow/non-fallow edit dialogs** — locked decision: "No visual distinction between fallow and regular enterprise edit forms."

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Currency display | Custom formatter | `toFixed(2)` or native `Intl.NumberFormat` | Already consistent with project pattern; no display formatter needed in form (raw number input) |
| Form validation | Custom validation hook | Inline guard in `handleSave` | Project pattern is already inline guards — `toast.error` on invalid state |

**Key insight:** This fix requires no new abstractions. The project already uses the exact pattern needed — the only gap is two missing lines of pre-fill code and a missing interface property.

---

## Common Pitfalls

### Pitfall 1: Float-to-String Conversion Precision

**What goes wrong:** `(125.1234567).toString()` produces `"125.1234567"` in the Input, which may surprise users expecting `"125.12"`.
**Why it happens:** JavaScript's `toString()` on a float preserves full precision.
**How to avoid:** Use `ent.fallowCostAmount.toFixed(2)` instead of `.toString()` when the stored value is non-null. This renders `"125.12"` consistently.
**Updated pattern:**
```typescript
fallowCostAmount: ent.fallowCostAmount != null
  ? ent.fallowCostAmount.toFixed(2)
  : "0.00",
```

### Pitfall 2: `|| ""` Coercing Zero to Empty

**What goes wrong:** `ent.fallowCostAmount || ""` evaluates to `""` when `fallowCostAmount` is `0` (a valid value), making a $0.00 cost look like unset data.
**Why it happens:** `0` is falsy in JavaScript.
**How to avoid:** Always use `!= null` ternary: `ent.fallowCostAmount != null ? ... : "0.00"`.
**Warning signs:** Input field shows blank when editing a fallow enterprise that previously had a $0 overhead (e.g., fallow acres without cash rent).

### Pitfall 3: PUT Route Sends Wrong Cost Data on Edit

**What goes wrong:** If `form.isFallow` is `true` at save time but the save path sends `fallowCostAmount: null`, the database overwrites the user's stored cost with null (data loss on a save that didn't touch the cost field).
**Why it happens:** Existing `parseFloat("") || null` evaluates to `null` for an empty string. After the fix, pre-fill prevents the empty string, but the serialization fix (`|| 0`) is still the safer pattern.
**How to avoid:** The serialization fix (`|| 0`) ensures even edge cases (user manually clears the field) write `0` not `null`.

### Pitfall 4: TypeScript Interface Out of Sync with API Response

**What goes wrong:** The API (`GET /api/field-enterprises`) returns the full Prisma `FieldEnterprise` model including `fallowCostAmount` and `fallowCostCategory`, but the TypeScript interface in the page doesn't declare them. TypeScript allows `ent.fallowCostAmount` to go undetected as `undefined` at runtime rather than `null`.
**Why it happens:** When you access a property not in an interface, TypeScript returns `undefined` instead of the actual value — so even if `ent.fallowCostAmount` is `125.00` from the API, TypeScript sees it as `undefined` and won't complain when it's omitted in `openEdit()`.
**How to avoid:** Add the two fields to the interface first, before fixing `openEdit()`. TypeScript will then enforce that the pre-fill code reads from typed fields.

---

## Code Examples

Verified from codebase inspection:

### Complete Fixed openEdit() Function

```typescript
// Source: organic-cert/src/app/(app)/field-enterprises/page.tsx
function openEdit(ent: FieldEnterprise) {
  setEditing(ent);
  setForm({
    fieldId: ent.field.id,
    cropYear: ent.cropYear.toString(),
    crop: ent.isFallow ? "" : ent.crop,
    variety: ent.variety || "",
    plantedAcres: ent.plantedAcres.toString(),
    organicStatus: ent.organicStatus,
    label: ent.label || "",
    isFallow: ent.isFallow,
    fallowCostAmount: ent.fallowCostAmount != null
      ? ent.fallowCostAmount.toFixed(2)
      : "0.00",
    fallowCostCategory: ent.fallowCostCategory || "",
  });
  setDialogOpen(true);
}
```

### Complete Fixed FieldEnterprise Interface

```typescript
// Source: organic-cert/src/app/(app)/field-enterprises/page.tsx
interface FieldEnterprise {
  id: string;
  cropYear: number;
  crop: string;
  variety: string | null;
  label: string | null;
  isFallow: boolean;
  fallowCostAmount: number | null;
  fallowCostCategory: string | null;
  plantedAcres: number;
  lotNumber: string | null;
  organicStatus: string;
  locked: boolean;
  field: { id: string; name: string };
}
```

### Fixed Save Serialization (handleSave)

```typescript
// Source: organic-cert/src/app/(app)/field-enterprises/page.tsx
// Change in handleSave() — the isFallow block
if (form.isFallow) {
  body.fallowCostAmount = parseFloat(form.fallowCostAmount) || 0;  // was: || null
  body.fallowCostCategory = form.fallowCostCategory || null;        // unchanged
}
```

---

## What Does NOT Need to Change

Confirmed by code inspection (HIGH confidence):

| Component | Status | Reason |
|-----------|--------|--------|
| Prisma schema | No change | `fallowCostAmount Float?` and `fallowCostCategory String?` exist on `FieldEnterprise` |
| `GET /api/field-enterprises` | No change | Returns full model including fallow cost fields via Prisma |
| `PUT /api/field-enterprises/[id]` | No change | Correctly spreads `body` into Prisma update; fallow cost fields pass through |
| `POST /api/field-enterprises` | No change | Create flow is not broken (only edit pre-fill is broken) |
| Form Dialog JSX | No change | Fallow cost Input fields are already rendered correctly when `form.isFallow` is true |
| Fallow toggle Switch | No change | Toggling to fallow in create mode already works |
| Save & Add Another | No change | Only available on create (not edit), not affected |
| Any PDF/report code | No change | This phase only fixes the edit form; PDF rendering is not involved |

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Reset all form fields to defaults on `openEdit()` | Pre-fill from stored record for fields that carry persisted data | Pre-fill is the standard pattern for edit forms in React; the reset was likely a copy-paste from `openCreate()` |

**Deprecated/outdated:**
- Nothing. This is a straightforward bug in form initialization, not a technology pattern issue.

---

## Open Questions

1. **Should `fallowCostAmount` Input have `min="0"` to enforce non-negative?**
   - What we know: Locked decision says "Numeric only, no negative values." The existing Input uses `type="number"` and `step="0.01"` but no `min`.
   - What's unclear: Whether to add `min="0"` as HTML attribute or only validate on save (via guard in `handleSave`).
   - Recommendation: Add `min="0"` to the Input for native browser enforcement, and optionally add a save-time guard (`if (parseFloat(form.fallowCostAmount) < 0) { toast.error(...); return; }`). The HTML attribute alone is sufficient given the low-stakes context (Claude's Discretion area).

2. **Does `toFixed(2)` vs `.toString()` matter for the save round-trip?**
   - What we know: Prisma stores `Float?` which is PostgreSQL `double precision`. Values like `125.1234` can be stored and retrieved with full precision.
   - What's unclear: Whether the user ever enters values with more than 2 decimal places.
   - Recommendation: Use `toFixed(2)` for display; `parseFloat()` on save preserves the user's edited value regardless. No data loss risk.

---

## File Change Surface

**Single file** — all changes in one location:

```
organic-cert/src/app/(app)/field-enterprises/page.tsx
```

| Change | Lines Affected | Type |
|--------|---------------|------|
| Extend `FieldEnterprise` interface | Lines 35-47 | Add 2 properties |
| Fix `openEdit()` pre-fill | Lines 148-151 | Replace 2 lines |
| Fix `handleSave()` serialization | Line 177 | Replace 1 expression |

**Total:** 3 targeted edits, all in the same file. No migration, no new files, no API changes.

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection: `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/app/(app)/field-enterprises/page.tsx` — confirmed the bug at `openEdit()` lines 148-151 and the missing interface fields
- Direct codebase inspection: `/Users/glomalinguild/Desktop/my-project-one/organic-cert/prisma/schema.prisma` — confirmed `fallowCostAmount Float?` and `fallowCostCategory String?` exist on `FieldEnterprise` model (lines 297-298)
- Direct codebase inspection: `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/app/api/field-enterprises/route.ts` — confirmed `GET` returns full model, no API changes needed
- Direct codebase inspection: `/Users/glomalinguild/Desktop/my-project-one/organic-cert/src/app/api/field-enterprises/[id]/route.ts` — confirmed `PUT` correctly spreads body to Prisma update

### Secondary (MEDIUM confidence)

- JavaScript language behavior: `0 || null` evaluates to `null` (falsy coercion) — language spec, no external source needed
- JavaScript language behavior: `ent.missingProp` on an object with no TypeScript type annotation returns `undefined`, not `null` — language spec

### Tertiary (LOW confidence)

- None — all findings are from direct codebase inspection or language fundamentals.

---

## Metadata

**Confidence breakdown:**
- Bug location: HIGH — confirmed by direct code inspection, specific line numbers identified
- Fix approach: HIGH — follows existing patterns in the same file; no new patterns introduced
- Impact scope: HIGH — single file, three targeted edits, no downstream effects confirmed by API + schema inspection

**Research date:** 2026-03-01
**Valid until:** Stable until `page.tsx` is refactored — the fix is localized and not subject to library churn
