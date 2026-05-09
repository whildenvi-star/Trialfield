# Phase 71: Unified Field Operations View - Research

**Researched:** 2026-05-08
**Domain:** Vanilla JS SPA field editor — grouped operation view, HTML5 drag-and-drop, inline form injection
**Confidence:** HIGH (phase fully implemented and verified; research derived from shipped code)

---

> **Note:** Phase 71 is COMPLETE as of 2026-04-23. All 3 plans executed, 12/12 automated verification checks pass, 6 human-verification items documented. This RESEARCH.md documents the patterns used in the shipped implementation for downstream reference and institutional memory.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Groups follow agronomic sequence: Tillage → Planting → Pre-emerge → Post-emerge → Fungicide → Harvest (in that order)
- Actual sequence implemented: Tillage → Fertility → Planting → Pre-emerge → Post-emerge → Fungicide → Harvest → Other
- Group assignment from operation name pattern-matching against real data.json naming conventions
- Empty groups are hidden — only operations with items appear
- Each operation group is a collapsible section — expanded by default, collapse available
- Group header row shows: operation name + subtotal ($/ac)
- Line items: compact table-row density, same as existing Inputs/Machinery tables
- Columns per row: item name, type badge, rate, $/ac, field total $
- Items are co-located by group — no parent/child nesting
- Type badge labels: `input`, `pass`, `custom`, `seed`
- Scope: one enterprise at a time
- Unified Field Ops view IS the editing surface — edit from within it
- Click a row to edit inline; click + under a group to add a new item
- Full drag within AND across groups
- Desktop primary — not mobile-first

### Claude's Discretion
- Ungrouped item handling → implemented as "Other" catch-all group
- Grand total placement → implemented as sticky-style bottom row visible when grandTotal > 0
- Add-item form UX → inline tbody row injection matching existing pattern
- Nav restructuring → single "Field Ops" li replacing both "Inputs" and "Machinery" li items

### Deferred Ideas (OUT OF SCOPE)
- None surfaced during discussion
</user_constraints>

---

## Summary

Phase 71 redesigned the farm-budget field editor (port 3001, vanilla JS SPA, JSON-backed) to replace two separate "Inputs" and "Machinery" nav sections with a single unified "Field Operations" panel. All cost items — product inputs, custom coop application charges (type `custom`), machinery passes (type `pass`), and seed display rows (type `seed`) — are organized by agronomic operation type in a structured, report-style grouped layout.

The implementation required zero new npm packages. It uses: a new IIFE module (`field-ops-groups.js`) for classification, native HTML5 drag-and-drop for within-group reordering and cross-group reassignment, inline tbody row injection for add-item forms, and `operationGroup` / `foSortOrder` fields persisted on items in `data.json` to survive re-renders.

The key architectural insight is that the unified view is a **read-render layer on top of the existing `currentField.inputs` and `currentField.machinery` arrays** — it does not restructure the backing data, it only presents it differently. Edits via the Field Ops panel write back to those same arrays; the budget calculation code (`calc.js`, `updatePreview()`) is untouched.

**Primary recommendation:** When adding operation-grouped views to existing vanilla JS SPAs with flat data arrays, keep the backing data structure flat and add classification at render time via a thin classifier module. Persist group overrides as a field on the item itself (`operationGroup`), not as a separate structure.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS (ES5) | — | All UI logic | Matches existing farm-budget codebase; no bundler |
| Native HTML5 DnD API | — | Drag-and-drop within and across groups | No library dependency; adequate for desktop-primary tool |
| CSS custom properties | — | Theming (day/night toggle) | Already used throughout; `var(--primary)`, `var(--bg)`, `var(--text-light)` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| IIFE window module pattern | — | Encapsulate classifier, expose via `window.FieldOpsGroups` | Any shared utility that must load before dependent script |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native HTML5 DnD | SortableJS / @dnd-kit | More features (touch, animation) but adds a dependency; not worth it for desktop-only, simple two-axis DnD |
| Inline IIFE module | ES module import | ES modules require bundler or `type="module"` — incompatible with the existing vanilla script-tag stack |
| Pattern-match classifier | Machine learning / fuzzy match | Overkill; 60+ deterministic patterns from real data.json names cover all cases; `Other` is the safe fallback |

**Installation:** No new packages. Phase 71 added zero npm dependencies.

---

## Architecture Patterns

### Recommended Project Structure
```
farm-budget/public/
├── field-ops-groups.js    # Classifier IIFE — must load before field-editor.js
├── field-editor.js        # renderFieldOpsPanel() + makeFoGroupsDraggable()
├── index.html             # Panel skeleton, script tag order, nav item
└── style.css              # .fo-group, .fo-type-badge, .fo-grand-total, .fo-drop-target CSS
```

### Pattern 1: IIFE Window Module for Shared Classifier

**What:** A self-executing function that assigns `window.FieldOpsGroups = { GROUP_ORDER, classifyItem }`. Loaded via `<script src="field-ops-groups.js">` before `field-editor.js`.

**When to use:** Any vanilla JS utility that must be shared between files without a bundler.

**Example:**
```javascript
// field-ops-groups.js
(function (window) {
  'use strict';
  var GROUP_ORDER = ['Tillage', 'Fertility', 'Planting', 'Pre-emerge', 'Post-emerge', 'Fungicide', 'Harvest', 'Other'];

  var RULES = [
    { group: 'Tillage', patterns: ['chisel', 'disk', 'soil finisher', 'cultivat'] },
    { group: 'Fertility', patterns: ['46-0-0', '28%', 'potash', 'anhydrous', 'urea', 'manure'] },
    // ... etc
    { group: 'Harvest', patterns: ['combine', 'buggy', 'trucking'] }
  ];

  function classifyItem(name, itemType) {
    if (!name) return 'Other';
    var lower = name.toLowerCase();
    for (var r = 0; r < RULES.length; r++) {
      var rule = RULES[r];
      for (var p = 0; p < rule.patterns.length; p++) {
        if (lower.indexOf(rule.patterns[p]) !== -1) return rule.group;
      }
    }
    return 'Other';
  }

  window.FieldOpsGroups = { GROUP_ORDER: GROUP_ORDER, classifyItem: classifyItem };
})(typeof window !== 'undefined' ? window : this);
```

### Pattern 2: Render-on-Top-of-Existing-Arrays

**What:** `renderFieldOpsPanel()` does not restructure `currentField.inputs` or `currentField.machinery`. Instead it iterates both arrays, tags each item with `sourceType` and `sourceIdx`, classifies via `FieldOpsGroups.classifyItem()`, and builds HTML groups. Edits write back to the original array position via `sourceIdx`.

**When to use:** When a new view must present existing data differently without migrating the data model.

**Key fields added to items (persisted in data.json):**
- `operationGroup` — user override for group assignment (set by cross-group DnD or inline add); checked before `classifyItem()` is called
- `foSortOrder` — numeric sort order within a group (set by within-group DnD); items without it preserve insertion order

### Pattern 3: operationGroup Override

**What:** Before calling `classifyItem()`, `renderFieldOpsPanel()` checks `sourceItem.operationGroup` on the backing array item. If set, that group wins.

**Why:** Cross-group drag-and-drop writes `arr[sourceIdx].operationGroup = targetGroup` to the backing item. On next render, the override takes precedence — the user's manual assignment survives re-renders and is persisted to `data.json` on field save.

```javascript
var group = (sourceItem && sourceItem.operationGroup)
  ? sourceItem.operationGroup
  : window.FieldOpsGroups.classifyItem(item.name, item.itemType);
```

### Pattern 4: Native HTML5 DnD with Two Axes

**What:** `makeFoGroupsDraggable()` implements two distinct drop behaviors on the same set of rows:

1. **Within-group row reorder** — handled by `row.addEventListener('dragover', ...)` and `row.addEventListener('drop', ...)`. Only fires when `dragSrc.origGroup === rowGroup`. Writes `foSortOrder` to all items in the group based on final DOM order.

2. **Cross-group reassignment** — handled by `group.addEventListener('drop', ...)`. Only fires when `dragSrc.origGroup !== targetGroup`. Writes `operationGroup` override to source item.

**The mutual-exclusion trick:** Row-level `drop` handler calls `e.stopPropagation()`, which prevents the group-level handler from also firing on within-group drops.

**When to use:** When items must be orderable within a container AND movable between containers, without a DnD library.

```javascript
// Within-group: row-level drop
row.addEventListener('drop', function (e) {
  e.preventDefault();
  e.stopPropagation(); // prevents group-level handler from firing
  if (dragSrc.origGroup !== rowGroup) return; // only handle same-group drops
  // ... write foSortOrder
});

// Cross-group: group-level drop
group.addEventListener('drop', function (e) {
  e.preventDefault();
  if (!dragSrc || dragSrc.origGroup === targetGroup) return; // skip same-group
  arr[dragSrc.sourceIdx].operationGroup = targetGroup; // write override
});
```

### Pattern 5: Inline tbody Row Injection for Add-Item Form

**What:** `.fo-add-item` click handler hides all other add buttons, inserts a new `<tr class="fo-confirm-form-row">` at the end of the group's `<tbody>`, and wires confirm/cancel buttons. Confirm pushes a new item to `currentField.inputs` or `currentField.machinery` with `operationGroup: groupName` set, then calls `renderFieldOpsPanel()`.

**When to use:** When an add-form must appear contextually within a table row without a modal.

### Pattern 6: Type Badge Classification

**What:** Each item gets a `itemType` tag:
- `input` — standard product from `currentField.inputs` (name does NOT start with "application -")
- `custom` — coop application charges from `currentField.inputs` where `name.toLowerCase().indexOf('application -') === 0`
- `pass` — machinery passes from `currentField.machinery`
- `seed` — display-only rows from `currentField.seeds` (zero cost; edit stays in Seed tab)

CSS classes: `.fo-badge-input`, `.fo-badge-pass`, `.fo-badge-custom`, `.fo-badge-seed`

### Anti-Patterns to Avoid

- **Restructuring backing arrays to match groups:** Keep `currentField.inputs` and `currentField.machinery` flat. Classification is a render-time concern. The budget sidebar (`updatePreview()`) reads those flat arrays directly.
- **Using a library for simple desktop DnD:** Native HTML5 drag events are sufficient for a desktop-primary farm management tool with no touch requirement.
- **Applying `foSortOrder` to seed rows:** Seeds are display-only in the Field Ops panel. Sort order and group assignment only apply to `inputs` and `machinery` arrays.
- **Trusting `data-source-idx` after a splice:** After `currentField.inputs.splice(idx, 1)`, all subsequent indices shift. Always call `renderFieldOpsPanel()` immediately after any splice so DOM indices stay in sync with array indices.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Group classification | Custom ad-hoc conditionals scattered in render function | `field-ops-groups.js` IIFE module with `classifyItem()` | Centralizes 60+ patterns; testable in isolation with `node -e`; survives hot-reload without bundler |
| Cross-group DnD | Custom pointer-event drag tracking | Native HTML5 DnD API (`dragstart`, `dragover`, `drop`, `dragend`) | Already works; no touch needed; amber `.fo-drop-target` outline handled via CSS class toggle |
| Item sort persistence | Separate sort-order table or localStorage | `foSortOrder` field on the item object itself, written to `data.json` on save | Zero schema migration; survives server restart; consistent with how `operationGroup` is stored |

---

## Common Pitfalls

### Pitfall 1: Script Load Order

**What goes wrong:** `field-editor.js` calls `window.FieldOpsGroups.classifyItem()` inside `renderFieldOpsPanel()`. If `field-ops-groups.js` loads after `field-editor.js`, `window.FieldOpsGroups` is undefined and the panel renders an error message.

**Why it happens:** Script tags execute in document order. Adding a new script without placing it before the dependent script.

**How to avoid:** `field-ops-groups.js` must be the `<script>` tag immediately before `field-editor.js` in `index.html`.

**Warning signs:** Panel shows "FieldOpsGroups module not loaded." error text instead of groups. Check script tag order in index.html.

### Pitfall 2: operationGroup Override Not Checked Before classifyItem

**What goes wrong:** After a user drags an item to a different group, it snaps back to its classifier-assigned group on next render because `classifyItem()` is called without first checking the persisted `operationGroup` override.

**Why it happens:** Forgetting that `operationGroup` is the user's explicit signal and must win over auto-classification.

**How to avoid:** Always check `sourceItem.operationGroup` before calling `classifyItem()`. See Pattern 3 above.

### Pitfall 3: data-source-idx Stale After Splice

**What goes wrong:** User removes item at index 2. The DOM still shows items with `data-source-idx="3"`, `"4"` etc. Next interaction on those rows writes to the wrong backing array position.

**Why it happens:** `splice()` shifts all subsequent array indices but DOM attributes are static until re-render.

**How to avoid:** Every operation that modifies `currentField.inputs` or `currentField.machinery` (remove, add, DnD) must call `renderFieldOpsPanel()` immediately after — never defer re-render.

### Pitfall 4: Seed Rows Must Be Display-Only

**What goes wrong:** Attempting to add DnD, remove buttons, or cost editing to seed rows in the Field Ops panel causes double-computation: seed costs are calculated in the Seed tab and should not be re-added via the Field Ops panel.

**Why it happens:** Seed rows appear in the Field Ops panel for context but their cost is `0` and edit stays in the Seed tab.

**How to avoid:** Check `item.itemType === 'seed'` before rendering drag handles, remove buttons, or editable rate cells. Render a "Seed tab" label in those columns instead.

### Pitfall 5: Group Drop Handler Fires on Within-Group Drops Without stopPropagation

**What goes wrong:** Dropping a row onto another row in the same group triggers both the row-level `drop` (correct) AND the group-level `drop` (wrong — writes `operationGroup` override for a same-group move).

**Why it happens:** Events bubble from row → tbody → group div.

**How to avoid:** Within-group row `drop` handler must call `e.stopPropagation()` to prevent the group-level handler from also executing.

---

## Code Examples

### Classifier Module Test (node)

```bash
# Source: field-ops-groups.js + node -e pattern from 71-01-PLAN.md
node -e "
const code = require('fs').readFileSync('farm-budget/public/field-ops-groups.js', 'utf8');
const g = {};
(new Function('window', code))(g);
const FG = g.FieldOpsGroups;
console.log(FG.classifyItem('Combine + Buggy', 'pass'));   // => Harvest
console.log(FG.classifyItem('Application - Post', 'custom')); // => Post-emerge
console.log(FG.classifyItem('46-0-0 SideDress N', 'input')); // => Fertility
console.log(FG.classifyItem('Wi Tonnage Tax', 'custom'));    // => Other
"
```

### operationGroup Override Check (from field-editor.js line 822-828)

```javascript
// Source: farm-budget/public/field-editor.js
var sourceArr = item.sourceType === 'input' ? (currentField.inputs || []) :
  item.sourceType === 'machinery' ? (currentField.machinery || []) : [];
var sourceItem = sourceArr[item.sourceIdx];
var group = (sourceItem && sourceItem.operationGroup)
  ? sourceItem.operationGroup
  : window.FieldOpsGroups.classifyItem(item.name, item.itemType);
```

### Cross-Group Drop Handler (from field-editor.js line 1736-1750)

```javascript
// Source: farm-budget/public/field-editor.js — makeFoGroupsDraggable()
group.addEventListener('drop', function (e) {
  e.preventDefault();
  group.classList.remove('fo-drop-target');
  if (!dragSrc || dragSrc.origGroup === targetGroup) return;
  var arr = dragSrc.sourceType === 'machinery'
    ? currentField.machinery
    : currentField.inputs;
  if (!arr || dragSrc.sourceIdx >= arr.length) return;
  arr[dragSrc.sourceIdx].operationGroup = targetGroup;
  renderFieldOpsPanel();
  updatePreview();
});
```

### foSortOrder Write-Back After Within-Group Reorder (from field-editor.js line 1706-1709)

```javascript
// Source: farm-budget/public/field-editor.js — within-group drop handler
ordered.forEach(function (item, order) {
  var arr = item.sourceType === 'machinery' ? currentField.machinery : currentField.inputs;
  if (arr && arr[item.sourceIdx]) arr[item.sourceIdx].foSortOrder = order;
});
```

### Inline Add-Item Form Confirm (push to backing array with operationGroup set)

```javascript
// Source: farm-budget/public/field-editor.js — fo-add-confirm handler
if (type === 'input' || type === 'custom') {
  currentField.inputs.push({
    id: util.generateId('inp'),
    productName: name,
    quantity: qty,
    operationGroup: groupName   // locks item to this group on re-render
  });
} else {
  currentField.machinery.push({
    id: util.generateId('mach'),
    implementName: name,
    passes: qty || 1,
    operationGroup: groupName
  });
}
renderFieldOpsPanel();
updatePreview();
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate "Inputs" and "Machinery" nav tabs in field editor | Single "Field Ops" nav tab grouping all cost items by agronomic operation | Phase 71 (2026-04-20) | Farm operations read as a season workflow (Tillage → Harvest) rather than accounting categories |
| Custom application charges (e.g., "Application - Post") buried in Inputs table | First-class `custom` type badge in Post-emerge group | Phase 71 (2026-04-20) | Coop application charges appear next to the products they applied, in the right agronomic section |
| No persistence of item sort order | `foSortOrder` field on item object, saved to data.json | Phase 71 (2026-04-20) | User-defined row order within a group survives save/reload |
| No group assignment persistence | `operationGroup` field on item object, saved to data.json | Phase 71 (2026-04-20) | Cross-group DnD reassignment persists across re-renders and server restart |

**Deprecated/outdated:**
- Inputs nav tab: removed from field editor sidebar (data still in `currentField.inputs`; only the nav entry is gone)
- Machinery nav tab: removed from field editor sidebar (data still in `currentField.machinery`; only the nav entry is gone)

---

## Open Questions

1. **Per-group filter (not just global filter)**
   - What we know: The current status filter (`fo-filter-select`: all/planned/confirmed/disregarded) applies globally across all groups
   - What's unclear: A per-group filter might be useful for large operations with many groups, but was not requested
   - Recommendation: Leave as-is; the global filter covers the primary use case

2. **New product/implement names not in RULES**
   - What we know: Any name not matching a RULES pattern falls to 'Other'; `operationGroup` override allows manual correction via DnD
   - What's unclear: As the farm adds new products/implements, some may land in 'Other' unexpectedly
   - Recommendation: Treat DnD-to-correct as the graceful path; update RULES annually as new names appear in data.json

---

## Sources

### Primary (HIGH confidence)
- `farm-budget/public/field-ops-groups.js` — shipped classifier module, 243 lines
- `farm-budget/public/field-editor.js` — `renderFieldOpsPanel()` lines 692-1618, `makeFoGroupsDraggable()` lines 1620-1751
- `farm-budget/public/style.css` — lines 3611-3816 (all .fo-* CSS rules)
- `farm-budget/public/index.html` — panel skeleton, script tag order, nav item
- `.planning/phases/71-unified-field-operations-view/71-VERIFICATION.md` — 12/12 automated checks verified, 6 human-verification items
- `.planning/phases/71-unified-field-operations-view/71-CONTEXT.md` — locked decisions and discretion areas
- `.planning/STATE.md` — confirmed Phase 71 COMPLETE as of 2026-04-23

### Secondary (MEDIUM confidence)
- `.planning/phases/71-unified-field-operations-view/71-01-SUMMARY.md` — decisions log (Spinner → Pre-emerge, Rotary Hoe → Post-emerge, Adjuvants → Post-emerge, Bio amendments → Fertility)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — derived from shipped, verified code
- Architecture: HIGH — derived from shipped, verified code with inline source line citations
- Pitfalls: HIGH — derived from verification report, summaries, and known vanilla JS DnD gotchas confirmed in code

**Research date:** 2026-05-08
**Valid until:** Stable — farm-budget is a vanilla JS SPA with no framework churn; patterns are stable indefinitely unless farm-budget migrates to a bundler/framework
