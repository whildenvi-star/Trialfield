---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - farm-budget/public/index.html
  - farm-budget/public/calc.js
autonomous: true
requirements: [FIELDOPS-BUG-01, FIELDOPS-BUG-02, FIELDOPS-BUG-03]

must_haves:
  truths:
    - "Apply Program dropdown and button are accessible from the Field Ops panel"
    - "Save as Program button is accessible from the Field Ops panel"
    - "Items with passStatus='disregarded' contribute $0 to field cost"
    - "Confirmed inputs with actualQuantity set use actualQuantity in cost calculation"
  artifacts:
    - path: "farm-budget/public/index.html"
      provides: "Programs toolbar moved into fieldops-unified panel"
      contains: "id=\"ed-apply-program\""
    - path: "farm-budget/public/calc.js"
      provides: "passStatus-aware and actualQuantity-aware cost computation"
      contains: "passStatus"
  key_links:
    - from: "farm-budget/public/index.html"
      to: "farm-budget/public/field-editor.js"
      via: "getElementById('ed-apply-program-btn') and getElementById('ed-save-as-program')"
      pattern: "ed-apply-program"
---

<objective>
Fix three bugs in the farm-budget Field Ops panel introduced after Phase 71 restructured the Field Editor nav.

Purpose: The Apply Program / Save as Program toolbar became unreachable when the nav no longer links to data-section="inputs". Budget calculations also ignore passStatus (disregarded items still cost money) and actualQuantity (confirmed overrides are silently ignored).

Output: Accessible programs toolbar in Field Ops panel, correct zero-cost for disregarded items, correct actual-quantity use for confirmed inputs.
</objective>

<execution_context>
@/Users/glomalinguild/.claude/get-shit-done/workflows/execute-plan.md
@/Users/glomalinguild/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Surface programs toolbar in Field Ops panel (index.html)</name>
  <files>farm-budget/public/index.html</files>
  <action>
    In the `data-section="fieldops-unified"` panel (around line 1076), add the programs toolbar as a second row inside the existing `.fo-toolbar` div, after the closing `</span>` for `fo-collapse-all` and before the closing `</div>` of fo-toolbar.

    Specifically, insert a second flex row `<div>` inside the fo-toolbar div containing the programs bar. Add it immediately after the existing toolbar row (after the collapse-all button), like this:

    ```html
    <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.4rem;padding-top:0.4rem;border-top:1px solid var(--border);width:100%">
      <select id="ed-apply-program" style="flex:1;font-size:0.78rem">
        <option value="">-- Load Agronomic Program --</option>
      </select>
      <button id="ed-apply-program-btn" class="btn-sm btn-primary" style="font-size:0.75rem;padding:0.25rem 0.5rem">Apply</button>
      <button id="ed-save-as-program" class="btn-sm" style="font-size:0.75rem;padding:0.25rem 0.5rem" title="Save field as program template">Save as Program</button>
    </div>
    ```

    Change the outer `.fo-toolbar` div `style` to use `flex-wrap:wrap` so the two rows stack naturally: add `flex-wrap:wrap` to the existing inline style on the `.fo-toolbar` div.

    Then remove (or keep hidden) the original programs toolbar from `data-section="inputs"` (around line 1043-1049) to avoid duplicate element IDs. The simplest approach: delete just the `<div class="mach-tmpl-bar"...>` block containing the three program elements inside data-section="inputs". The inputs table (`#ed-inputs-table`) and the rest of that panel can remain as-is since they are still referenced internally, but the `data-section="inputs"` panel itself is no longer linked in the nav and will not be visible — removing the three program elements from it eliminates the duplicate-ID risk.

    Preserve element IDs exactly: `ed-apply-program`, `ed-apply-program-btn`, `ed-save-as-program`. The field-editor.js listeners (lines 2313 and 2344) bind on DOMContentLoaded to these exact IDs — no JS changes needed.
  </action>
  <verify>
    <automated>grep -n "ed-apply-program" /Users/glomalinguild/Desktop/my-project-one/farm-budget/public/index.html | wc -l</automated>
    <manual>Open field editor, navigate to Field Ops tab — confirm "Load Agronomic Program" dropdown and Apply/Save as Program buttons appear in the toolbar row below the filter/expand controls.</manual>
  </verify>
  <done>Exactly 3 occurrences of ed-apply-program IDs exist in index.html (one select, one apply btn, one save btn), all inside data-section="fieldops-unified". No duplicate IDs in data-section="inputs".</done>
</task>

<task type="auto">
  <name>Task 2: Fix calc.js — respect passStatus and actualQuantity in field cost</name>
  <files>farm-budget/public/calc.js</files>
  <action>
    In `computeFieldBudget`, apply two changes:

    **Bug 2 — Disregarded inputs/machinery contribute $0:**

    In the `result.inputDetails` map (around line 180), add a passStatus guard before computing cost:

    ```js
    result.inputDetails = (field.inputs || []).map(function (inp) {
      var product = findByName(refs.products, inp.productName);
      var appPrice = product ? computeApplicationPrice(product) : 0;
      var isDisregarded = inp.passStatus === 'disregarded';
      var effectiveQty = isDisregarded ? 0 :
        ((inp.passStatus === 'confirmed' && inp.actualQuantity != null) ? inp.actualQuantity : (inp.quantity || 0));
      var costPerAcre = effectiveQty * appPrice;
      if (!isDisregarded) {
        if ((inp.season || '').toLowerCase() === 'spring') springFert += costPerAcre;
        else if ((inp.season || '').toLowerCase() === 'fall') fallFert += costPerAcre;
        else unassignedFert += costPerAcre;
      }
      return {
        productName: inp.productName,
        quantity: inp.quantity || 0,
        actualQuantity: inp.actualQuantity || null,
        effectiveQuantity: effectiveQty,
        unit: product ? product.unit : '',
        applicationPrice: round4(appPrice),
        costPerAcre: round2(costPerAcre),
        totalCost: round2(costPerAcre * acres),
        season: inp.season || '',
        passStatus: inp.passStatus || 'planned'
      };
    });
    ```

    This single block resolves both Bug 2 (disregarded=0 cost) and Bug 3 (confirmed uses actualQuantity).

    In the `result.machineryDetails` map (around line 233), add a passStatus guard for disregarded machinery:

    Find the line `machCostPerAcre += cost;` and wrap it:
    ```js
    var mIsDisregarded = m.passStatus === 'disregarded';
    if (!mIsDisregarded) {
      machCostPerAcre += cost;
      fuelGallonsPerAcre += fuel;
      if (impl && impl.laborHoursPerAcre > 0) {
        laborHours += impl.laborHoursPerAcre * passes;
      }
    }
    ```
    Remove the standalone `machCostPerAcre += cost;`, `fuelGallonsPerAcre += fuel;`, and the existing labor block that follows, since they are now inside the guard. Add `passStatus: m.passStatus || 'planned'` to the returned object.

    Do NOT change any other logic in computeFieldBudget, computeEnterpriseSummary, or any export.
  </action>
  <verify>
    <automated>node -e "
    var calc = {};
    (function(exports){ $(cat /Users/glomalinguild/Desktop/my-project-one/farm-budget/public/calc.js) })(calc);
    var field = {
      acres: 100,
      inputs: [
        { productName: 'UAN32', quantity: 20, passStatus: 'confirmed', actualQuantity: 15 },
        { productName: 'Glyphosate', quantity: 10, passStatus: 'disregarded' }
      ],
      machinery: [
        { implementName: 'Sprayer', passes: 1, passStatus: 'disregarded' }
      ]
    };
    var refs = { products: [{name:'UAN32',unit:'gal',pricePer:0.50,applicationRate:1},{name:'Glyphosate',unit:'gal',pricePer:5,applicationRate:1}], implements: [{name:'Sprayer',costPerAcre:8,fuelGalPerAcre:0.5,laborHoursPerAcre:0}], cropPricing:[], laborOverhead:0, seeds:[] };
    var b = calc.computeFieldBudget(field, refs, {});
    // confirmed input should use actualQuantity=15, disregarded input $0, disregarded machinery $0
    console.log('inputDetails[0].effectiveQuantity:', b.inputDetails[0].effectiveQuantity); // expect 15
    console.log('inputDetails[1].costPerAcre:', b.inputDetails[1].costPerAcre); // expect 0
    console.log('machineryPerAcre:', b.machineryPerAcre); // expect 0
    " 2>&1 || echo "NOTE: inline eval syntax — verify manually if node eval fails"</automated>
    <manual>In farm-budget field editor, mark an input as disregarded and confirm the budget $/ac column for that field drops to reflect $0 for that product. Set actualQuantity on a confirmed input and confirm the budget uses the actual qty not planned.</manual>
  </verify>
  <done>
    - Disregarded inputs have costPerAcre=0 in budget output.
    - Confirmed inputs with actualQuantity use actualQuantity for cost, not quantity.
    - Disregarded machinery contributes 0 to machineryPerAcre.
    - All existing calc.js exports unchanged (computeFieldBudget, computeEnterpriseSummary, computeDashboard).
  </done>
</task>

</tasks>

<verification>
1. No duplicate element IDs: `grep -c "id=\"ed-apply-program\"" farm-budget/public/index.html` returns 1 (plus id="ed-apply-program-btn" returns 1, id="ed-save-as-program" returns 1).
2. calc.js still loads without errors: `node -e "var e={}; require('./farm-budget/public/calc.js')" 2>&1` — but since it's a browser UMD module, verify by loading farm-budget in browser and opening field editor without console errors.
3. Field Ops tab shows Apply Program toolbar row.
4. Disregarded field ops items show $0 in budget.
</verification>

<success_criteria>
- Apply Program dropdown + buttons visible and functional in the Field Ops panel toolbar
- Disregarded inputs/machinery excluded from budget totals
- Confirmed inputs with actualQuantity use actual qty in budget
- No JavaScript console errors on field editor load
- No duplicate element IDs in index.html
</success_criteria>

<output>
After completion, create `.planning/quick/1-fix-3-field-ops-bugs-program-apply-butto/1-SUMMARY.md`
</output>
