import { fetchBudgetService, fetchGrainService } from '@/app/api/mobile/_lib/proxy'
import { CURRENT_CROP_YEAR } from '@/lib/config'
import { Badge } from '@/components/ui/badge'
import { Empty } from '@/components/ui/empty'
import { YearSelector } from '@/components/ui/year-selector'
import { createClient } from '@/lib/supabase/server'
import { buildSvgThumb, type GeoJsonGeometry } from '@/lib/utils/field-thumb'

// ── Types ─────────────────────────────────────────────────────────────────────

interface BudgetField {
  fieldName: string
  crop: string
  acres: number
  enterpriseName?: string
  category?: string
  seedPerAcre: number
  fertPerAcre: number
  dryingPerAcre: number
  insurancePerAcre: number
  expPerAcre: number
  cropIncomePerAcre: number
}

interface SettlementRow {
  crop: string
  netPayment: number
  deliveredBushels: number
}

interface SummaryRow {
  fieldName: string
  crop: string
  enterpriseName: string
  category: string
  acres: number
  seedPerAcre: number
  inputsPerAcre: number
  dryingPerAcre: number
  insurancePerAcre: number
  totalCostPerAcre: number
  revenuePerAcre: number | null
  revenueSource: 'Actual' | 'Budget Est.' | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const r2 = (n: number) => Math.round(n * 100) / 100
const fmt = (n: number | null) => n == null ? '—' : `$${n.toFixed(0)}`


function groupByEnterprise(rows: SummaryRow[]) {
  const map = new Map<string, SummaryRow[]>()
  for (const row of rows) {
    if (!map.has(row.enterpriseName)) map.set(row.enterpriseName, [])
    map.get(row.enterpriseName)!.push(row)
  }
  return map
}

function subtotal(rows: SummaryRow[]) {
  const acres = rows.reduce((s, r) => s + r.acres, 0)
  const wavg = (key: keyof SummaryRow) =>
    acres > 0 ? rows.reduce((s, r) => s + (r[key] as number) * r.acres, 0) / acres : 0
  const revRows = rows.filter(r => r.revenuePerAcre != null)
  const revPerAcre = revRows.length > 0
    ? revRows.reduce((s, r) => s + r.revenuePerAcre! * r.acres, 0) / revRows.reduce((s, r) => s + r.acres, 0)
    : null
  return {
    acres,
    seedPerAcre: wavg('seedPerAcre'),
    inputsPerAcre: wavg('inputsPerAcre'),
    dryingPerAcre: wavg('dryingPerAcre'),
    insurancePerAcre: wavg('insurancePerAcre'),
    totalCostPerAcre: wavg('totalCostPerAcre'),
    revenuePerAcre: revPerAcre,
  }
}

// ── Page (Server Component) ───────────────────────────────────────────────────

export default async function EnterpriseSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const { year: yearParam } = await searchParams
  const cropYear = yearParam ? parseInt(yearParam, 10) : CURRENT_CROP_YEAR

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let role = 'viewer'
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    role = profile?.role ?? 'viewer'
  }

  // 0. Field boundary thumbnails — name → geojson lookup (best-effort, no hard failure)
  const boundaryByName = new Map<string, GeoJsonGeometry>()
  try {
    const { data: boundaryRows } = await supabase
      .from('field_boundaries')
      .select('name, geojson')
      .eq('is_deleted', false)
    for (const row of boundaryRows ?? []) {
      if (row.name && row.geojson) {
        boundaryByName.set(row.name.toLowerCase().trim(), row.geojson as GeoJsonGeometry)
      }
    }
  } catch { /* thumbnails are decorative — never block the page */ }

  // 1. Budget costs from farm-budget
  let budgetFields: BudgetField[] = []
  let budgetOffline = false
  try {
    const res = await fetchBudgetService('/api/budget-field-details')
    if (res.ok) {
      const data = await res.json() as { fields?: BudgetField[] }
      budgetFields = (data.fields ?? []).filter(f => f.acres > 0)
    } else {
      budgetOffline = true
    }
  } catch {
    budgetOffline = true
  }

  // 2. Settlement revenue from grain-tickets
  let settlementRows: SettlementRow[] = []
  let settlementAvailable = false
  try {
    const res = await fetchGrainService(`/api/settlement-summary?cropYear=${cropYear}`)
    if (res.ok) {
      const data = await res.json() as { summary?: SettlementRow[] }
      settlementRows = data.summary ?? []
      settlementAvailable = settlementRows.length > 0
    }
  } catch {
    // grain-tickets offline — fall back to budget estimates
  }

  // 3. Build crop → netPayment map for proportional revenue allocation
  const cropNetMap = new Map<string, number>()
  const cropAcresMap = new Map<string, number>()
  for (const s of settlementRows) {
    const key = s.crop.toLowerCase().trim()
    cropNetMap.set(key, (cropNetMap.get(key) ?? 0) + s.netPayment)
  }
  for (const f of budgetFields) {
    const key = f.crop.toLowerCase().trim()
    if (cropNetMap.has(key)) {
      cropAcresMap.set(key, (cropAcresMap.get(key) ?? 0) + f.acres)
    }
  }

  // 4. Build rows — profit, labor, overhead intentionally excluded
  const rows: SummaryRow[] = budgetFields.map(f => {
    const cropKey = f.crop.toLowerCase().trim()
    const netPayment = cropNetMap.get(cropKey)
    const totalAcres = cropAcresMap.get(cropKey)
    let revenuePerAcre: number | null = null
    let revenueSource: 'Actual' | 'Budget Est.' | null = null

    if (settlementAvailable && netPayment != null && totalAcres && totalAcres > 0) {
      revenuePerAcre = r2(netPayment / totalAcres)
      revenueSource = 'Actual'
    } else if (f.cropIncomePerAcre > 0) {
      revenuePerAcre = r2(f.cropIncomePerAcre)
      revenueSource = 'Budget Est.'
    }

    return {
      fieldName: f.fieldName,
      crop: f.crop,
      enterpriseName: f.enterpriseName ?? f.crop,
      category: f.category ?? 'conventional',
      acres: f.acres,
      seedPerAcre: r2(f.seedPerAcre),
      inputsPerAcre: r2(f.fertPerAcre),
      dryingPerAcre: r2(f.dryingPerAcre),
      insurancePerAcre: r2(f.insurancePerAcre),
      totalCostPerAcre: r2(f.expPerAcre),
      revenuePerAcre,
      revenueSource,
    }
  })

  const grouped = groupByEnterprise(rows)

  return (
    <div className="p-4 md:p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-glomalin-text mb-1">Enterprise Summary</h1>
          <p className="text-sm text-glomalin-muted">{cropYear} crop year · seed, inputs, drying &amp; insurance costs</p>
        </div>
        <YearSelector currentYear={cropYear} />
      </div>

      {/* Banners */}
      {budgetOffline && (
        <div className="mb-4 px-4 py-3 bg-glomalin-warning/10 border border-glomalin-warning/30 text-glomalin-warning text-sm rounded">
          Farm-budget is offline — cost data unavailable
        </div>
      )}
      {!settlementAvailable && !budgetOffline && (
        <div className="mb-4 px-4 py-3 bg-glomalin-surface border border-glomalin-border text-glomalin-muted text-sm rounded">
          Revenue shows budget estimates — no settlement data on record for {cropYear}
        </div>
      )}

      {rows.length === 0 && !budgetOffline ? (
        <Empty title="No budget data found" description="Start farm-budget on port 3001 to see field data." />
      ) : (
        <div className="space-y-8">
          {Array.from(grouped.entries()).map(([enterpriseName, entRows]) => {
            const sub = subtotal(entRows)
            const isOrganic = entRows[0].category === 'organic'
            return (
              <div key={enterpriseName}>
                {/* Enterprise label */}
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-base font-semibold text-glomalin-text">{enterpriseName}</span>
                  <Badge variant={isOrganic ? 'success' : 'default'} size="sm">
                    {isOrganic ? 'organic' : 'conventional'}
                  </Badge>
                  <span className="text-sm text-glomalin-muted">{sub.acres.toFixed(1)} ac</span>
                </div>

                {/* Mobile card view — shown below md (768px) */}
                <div className="md:hidden space-y-2 mb-2">
                  {entRows.map((row, i) => {
                    const thumbGeo = boundaryByName.get(row.fieldName.toLowerCase().trim()) ?? null
                    return (
                    <div key={i} className="bg-glomalin-surface border border-glomalin-border rounded p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="flex items-center gap-2 text-sm font-mono text-glomalin-text font-semibold">
                          <span dangerouslySetInnerHTML={{ __html: buildSvgThumb(thumbGeo, 28) }} />
                          {row.fieldName}
                        </span>
                        <span className="text-xs font-mono text-glomalin-muted">
                          {row.acres.toFixed(1)} ac
                        </span>
                      </div>
                      <div className="text-xs font-mono text-glomalin-muted">
                        {row.crop}
                      </div>
                      {(role === 'admin' || role === 'office') && (
                        <div className="text-xs font-mono text-glomalin-muted mt-1">
                          Cost: {fmt(row.totalCostPerAcre)}/ac
                          {row.revenuePerAcre != null && (
                            <span className="ml-3 text-glomalin-success">
                              Rev: {fmt(row.revenuePerAcre)}/ac
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-xs font-mono text-glomalin-accent mt-2">
                        Open on desktop for full detail
                      </p>
                    </div>
                  )})}
                </div>

                {/* Desktop table — shown on md+ */}
                <div className="hidden md:block overflow-x-auto rounded border border-glomalin-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-glomalin-surface border-b border-glomalin-border text-glomalin-muted text-xs">
                        <th className="text-left px-4 py-2.5 font-medium">Field</th>
                        <th className="text-left px-4 py-2.5 font-medium">Crop</th>
                        <th className="text-right px-4 py-2.5 font-medium">Acres</th>
                        <th className="text-right px-4 py-2.5 font-medium">Seed/ac</th>
                        <th className="text-right px-4 py-2.5 font-medium">Inputs/ac</th>
                        <th className="text-right px-4 py-2.5 font-medium">Drying/ac</th>
                        <th className="text-right px-4 py-2.5 font-medium">Ins/ac</th>
                        <th className="text-right px-4 py-2.5 font-medium">Total Cost/ac</th>
                        <th className="text-right px-4 py-2.5 font-medium">Revenue/ac</th>
                        <th className="text-center px-4 py-2.5 font-medium">Src</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-glomalin-border">
                      {entRows.map((row, i) => {
                        const thumbGeo = boundaryByName.get(row.fieldName.toLowerCase().trim()) ?? null
                        return (
                        <tr key={i} className="hover:bg-glomalin-surface/50 transition-colors">
                          <td className="px-4 py-2.5 text-glomalin-text">
                            <span className="flex items-center gap-2">
                              <span dangerouslySetInnerHTML={{ __html: buildSvgThumb(thumbGeo, 30) }} />
                              {row.fieldName}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-glomalin-muted">{row.crop}</td>
                          <td className="px-4 py-2.5 text-right text-glomalin-muted">{row.acres.toFixed(1)}</td>
                          <td className="px-4 py-2.5 text-right">{fmt(row.seedPerAcre)}</td>
                          <td className="px-4 py-2.5 text-right">{fmt(row.inputsPerAcre)}</td>
                          <td className="px-4 py-2.5 text-right">{fmt(row.dryingPerAcre)}</td>
                          <td className="px-4 py-2.5 text-right">{fmt(row.insurancePerAcre)}</td>
                          <td className="px-4 py-2.5 text-right font-medium text-glomalin-text">{fmt(row.totalCostPerAcre)}</td>
                          <td className="px-4 py-2.5 text-right text-glomalin-success">{fmt(row.revenuePerAcre)}</td>
                          <td className="px-4 py-2.5 text-center">
                            {row.revenueSource === 'Actual' && (
                              <Badge variant="success" size="sm">Actual</Badge>
                            )}
                            {row.revenueSource === 'Budget Est.' && (
                              <Badge variant="warning" size="sm">Est.</Badge>
                            )}
                          </td>
                        </tr>
                      )})}
                      {/* Subtotal row */}
                      <tr className="bg-glomalin-surface font-medium text-glomalin-text">
                        <td className="px-4 py-2.5 text-glomalin-accent" colSpan={2}>Subtotal</td>
                        <td className="px-4 py-2.5 text-right text-glomalin-muted">{sub.acres.toFixed(1)}</td>
                        <td className="px-4 py-2.5 text-right">{fmt(sub.seedPerAcre)}</td>
                        <td className="px-4 py-2.5 text-right">{fmt(sub.inputsPerAcre)}</td>
                        <td className="px-4 py-2.5 text-right">{fmt(sub.dryingPerAcre)}</td>
                        <td className="px-4 py-2.5 text-right">{fmt(sub.insurancePerAcre)}</td>
                        <td className="px-4 py-2.5 text-right font-bold">{fmt(sub.totalCostPerAcre)}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-glomalin-success">{fmt(sub.revenuePerAcre)}</td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Footer note */}
      <div className="mt-8 text-xs text-glomalin-muted space-y-1">
        <div>Costs from farm-budget · seed, inputs (fert+chem), drying, insurance shown separately; total includes all budget categories</div>
        <div>Revenue from grain-tickets settlements when available, otherwise budget projection</div>
      </div>
    </div>
  )
}
