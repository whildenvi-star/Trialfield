"""Create the 2026 rye straw ops.

  python3 scripts/add-straw-ops-2026.py           # dry run
  python3 scripts/add-straw-ops-2026.py --apply

Rake / Bale / Haul on all three fields; Mow additionally on Buchanon and
Townline (Elwood's was not mowed).

Rates follow the Straw tab's own default logic — implements.costPerAcre via
OP_IMPLEMENT — but only where the basis is per-acre and the number therefore
means something:
    Mow  -> Mow and Condition  $14.00/ac
    Rake -> Windrow Merge      $11.60/ac
Bale (/bale) has no implement mapping, and Haul (/ton) maps to Chop/Haul whose
$50 is a PER-ACRE figure that must not be reused as a per-ton rate. Both are
created at 0 for the owner to fill in — a wrong rate here is worse than a blank.
"""
import json, sys, shutil, datetime, random, string

APPLY = '--apply' in sys.argv
P = 'data/data.json'
YEAR = 2026

#            op      basis    rate    fields
OPS = [
    ('Mow',  '/ac',  14.00,  ['Buchanon', 'Townline']),
    ('Rake', '/ac',  11.60,  ["Elwood's", 'Buchanon', 'Townline']),
    ('Bale', '/bale', 0.0,   ["Elwood's", 'Buchanon', 'Townline']),
    ('Haul', '/ton',  0.0,   ["Elwood's", 'Buchanon', 'Townline']),
]
NOTE = {'Bale': 'rate to set — no implement mapping',
        'Haul': 'rate to set — Chop/Haul $50 is per ACRE, not per ton'}

d = json.load(open(P))
d.setdefault('strawOps', [])
fields = {f['name']: f for f in d['fields'] if 'rye' in (f.get('crop') or '').lower()}
prod = {p['fieldId']: p for p in d.get('strawProduction', []) if int(p.get('cropYear') or 0) == YEAR}

def nid():
    return 'strawop_' + ''.join(random.choice(string.ascii_lowercase + string.digits) for _ in range(8))

print(f"{'APPLY' if APPLY else 'DRY RUN'}\n")
print(f"  {'farm':<10}{'op':<7}{'basis':<8}{'rate':>9}{'qty':>10}{'cost':>12}")
total = 0.0
for op, basis, rate, farms in OPS:
    for farm in farms:
        f = fields.get(farm)
        if not f:
            print(f'  !! no rye field {farm}'); continue
        dup = [o for o in d['strawOps'] if o.get('fieldId') == f['id'] and o.get('op') == op
               and int(o.get('cropYear') or 0) == YEAR]
        if dup:
            print(f'  {farm:<10}{op:<7} already present — skip'); continue
        acres = f.get('plantedAcres') or f.get('acres') or 0
        pr = prod.get(f['id'], {})
        bales = pr.get('bales') or 0
        tons = (bales * (pr.get('avgBaleLbs') or 0)) / 2000
        qty = {'/ac': acres, '/bale': bales, '/ton': tons}[basis]
        cost = qty * rate
        total += cost
        flag = '   <- ' + NOTE[op] if op in NOTE else ''
        print(f'  {farm:<10}{op:<7}{basis:<8}{rate:>9.2f}{qty:>10.2f}{cost:>12,.2f}{flag}')
        if APPLY:
            d['strawOps'].append({'id': nid(), 'fieldId': f['id'], 'farm': farm,
                                  'date': '2026-07-28', 'op': op, 'mode': 'own',
                                  'basis': basis, 'rate': rate, 'qtyOverride': '',
                                  'notes': NOTE.get(op, '2026 rye straw'), 'cropYear': YEAR})

print(f'\n  costed so far ${total:,.2f} against ${82044:,.2f} of straw income')
print('  Bale and Haul are $0 until you set them — the real cost is higher')

if APPLY:
    shutil.copy(P, P + '.bak.strawops.' + datetime.datetime.now().strftime('%Y%m%d%H%M%S'))
    json.dump(d, open(P, 'w'), indent=2)
    print('\n  written (backup taken)')
