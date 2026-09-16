"""2026 rye straw — set field auxPayments to settled actuals.

  python3 update-straw-actuals-2026.py           # dry run
  python3 update-straw-actuals-2026.py --apply

Rock Prairie and Pinnacle both paid $150/ton; 546.96 ton / 2,019 3x3 bales
across the three rye fields = $82,044.00. The budget carried $19,858 and had no
straw line at all on Elwood's.

  Elwood's   171.95 ton / 68.07 ac = 2.53 ton/ac  -> $378.91/ac  (Rock Prairie)
  Buchanon    84.36 ton / 38.00 ac = 2.22 ton/ac  -> $333.00/ac  (Rock Prairie)
  Townline   290.65 ton / 267.40 ac = 1.09 ton/ac -> $163.04/ac  (35.27 Rock Prairie + 255.38 Pinnacle)
"""
import json, sys, shutil, datetime

APPLY = '--apply' in sys.argv
P = '/srv/farm-ops/farm-budget/data/data.json'
RATE = 150.0
ACTUAL = {  # field name -> (tons, buyers note)
    "Elwood's": (171.95, 'Rock Prairie'),
    'Buchanon': (84.36, 'Rock Prairie'),
    'Townline': (290.65, 'Rock Prairie 35.27 t + Pinnacle 255.38 t'),
}

d = json.load(open(P))
changes = []
for f in d['fields']:
    name = f.get('name')
    if name not in ACTUAL or 'rye' not in (f.get('crop') or '').lower():
        continue
    tons, who = ACTUAL[name]
    acres = f.get('plantedAcres') or f.get('acres') or 0
    per_acre = round(tons * RATE / acres, 2)
    aux = f.get('auxPayments') or []
    row = next((a for a in aux if 'straw' in (a.get('label') or '').lower()), None)
    old = row.get('perAcre') if row else None
    changes.append((name, acres, tons, old, per_acre, acres * per_acre))
    if not APPLY:
        continue
    if row is None:
        row = {'label': 'STRAW'}
        aux.append(row)
        f['auxPayments'] = aux
    row['perAcre'] = per_acre
    row['note'] = f'2026 actual: {tons} ton @ ${RATE:.0f}/ton ({who})'

print(f"{'APPLY' if APPLY else 'DRY RUN'}\n")
print(f"  {'field':<12}{'acres':>8}{'ton':>9}{'was':>10}{'now':>10}{'total':>12}")
tot_old = tot_new = 0.0
for name, acres, tons, old, new, total in changes:
    tot_new += total
    tot_old += acres * (old or 0)
    print(f"  {name:<12}{acres:>8.2f}{tons:>9.2f}{('—' if old is None else '$'+str(old)):>10}{'$'+format(new,'.2f'):>10}{'$'+format(total,',.2f'):>12}")
print(f"\n  budgeted ${tot_old:,.2f} -> actual ${tot_new:,.2f}  (+${tot_new-tot_old:,.2f})")
print(f"  settlement grand total $82,044.00 — {'MATCH' if abs(tot_new-82044) < 1 else 'CHECK'}")

if APPLY:
    shutil.copy(P, P + '.bak.straw.' + datetime.datetime.now().strftime('%Y%m%d%H%M%S'))
    json.dump(d, open(P, 'w'), indent=2)
    print('\n  written (backup taken)')
