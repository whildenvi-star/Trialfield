"""Load the 2026 rye straw settlement into the straw module.

  python3 scripts/load-straw-2026.py           # dry run
  python3 scripts/load-straw-2026.py --apply

Populates strawProduction (bales + avg bale weight, so per-ton work and nutrient
removal cost out against tons MADE) and strawSales (tons sold per buyer). Ops
(mow / rake / bale / stack / haul) are deliberately left for the owner — the UI
seeds their rates from the implements table.

Rock Prairie is two delivery locations at the same $150/ton; the mileage
difference belongs in a Haul op, not in the price, so the location is carried in
the sale note. Idempotent: matches on field + buyer + tons.
"""
import json, sys, shutil, datetime

APPLY = '--apply' in sys.argv
P = 'data/data.json'
YEAR = 2026
RATE = 150.0

SALES = [
    ("Elwood's", 'Rock Prairie', 171.95, 583, 343900, 'Rock Prairie'),
    ('Buchanon', 'Rock Prairie', 84.36, 305, 168720, 'Rock Prairie'),
    ('Townline', 'Rock Prairie', 35.27, 126, 70540, 'Rock Prairie'),
    ('Townline', 'Pinnacle', 255.38, 1005, 510760, 'Pinnacle'),
]

d = json.load(open(P))
by_name = {}
for f in d['fields']:
    if 'rye' in (f.get('crop') or '').lower():
        by_name[f['name']] = f
for k in ('strawSales', 'strawOps', 'strawProduction'):
    d.setdefault(k, [])

def nid(prefix):
    import random, string
    return prefix + '_' + ''.join(random.choice(string.ascii_lowercase + string.digits) for _ in range(8))

# ── sales ──
added_sales = []
for farm, buyer, tons, bales, lbs, loc in SALES:
    f = by_name.get(farm)
    if not f:
        print(f'  !! no rye field named {farm}'); continue
    dup = [s for s in d['strawSales'] if s.get('fieldId') == f['id'] and s.get('buyer') == buyer
           and abs(float(s.get('tons') or 0) - tons) < 0.01 and int(s.get('cropYear') or 0) == YEAR]
    if dup:
        print(f'  {farm:<10} {buyer:<13} {tons:>8.2f} t  already present — skip'); continue
    row = {'id': nid('straw'), 'fieldId': f['id'], 'farm': farm, 'date': '2026-07-28',
           'buyer': buyer, 'tons': tons, 'pricePerTon': RATE,
           'notes': f'2026 rye straw settlement — delivered to {loc}; {bales} 3x3 bales, {lbs:,} lbs',
           'cropYear': YEAR}
    added_sales.append(row)
    print(f'  {farm:<10} {buyer:<13} {tons:>8.2f} t @ ${RATE:.0f} = ${tons*RATE:>10,.2f}   ({bales} bales)')
    if APPLY:
        d['strawSales'].append(row)

# ── production: bales and average bale weight per field ──
print()
prod = {}
for farm, buyer, tons, bales, lbs, loc in SALES:
    p = prod.setdefault(farm, [0, 0])
    p[0] += bales; p[1] += lbs
for farm, (bales, lbs) in prod.items():
    f = by_name.get(farm)
    if not f: continue
    avg = round(lbs / bales, 1) if bales else 0
    existing = next((r for r in d['strawProduction'] if r.get('fieldId') == f['id']
                     and int(r.get('cropYear') or 0) == YEAR), None)
    print(f'  {farm:<10} {bales:>5} bales  avg {avg:>6.1f} lbs  = {lbs/2000:>7.2f} tons made')
    if not APPLY:
        continue
    if existing:
        existing['bales'] = bales; existing['avgBaleLbs'] = avg
    else:
        d['strawProduction'].append({'id': nid('strawprod'), 'fieldId': f['id'], 'cropYear': YEAR,
                                     'bales': bales, 'avgBaleLbs': avg,
                                     'notes': '2026 rye straw settlement'})

tot_t = sum(s[2] for s in SALES)
print(f'\n  {len(SALES)} sales, {tot_t:.2f} tons, ${tot_t*RATE:,.2f}   (settlement $82,044.00)')
print('  ops (mow/rake/bale/stack/haul) intentionally not created — add them in the Straw tab')

if APPLY:
    shutil.copy(P, P + '.bak.strawload.' + datetime.datetime.now().strftime('%Y%m%d%H%M%S'))
    json.dump(d, open(P, 'w'), indent=2)
    print('\n  written (backup taken)')
