import { fetchBudgetService, fetchGrainService } from '@/app/api/mobile/_lib/proxy'
import { CURRENT_CROP_YEAR } from '@/lib/config'
import { YearSelector } from '@/components/ui/year-selector'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { instrumentPricedBu } from '@/lib/marketing/queries'
import type { SaleInstrument } from '@/lib/marketing/types'

interface BudgetField {
  fieldName: string
  crop: string
  acres: number
  expPerAcre: number
}

interface SettlementRow {
  crop: string
  netPayment: number
}

interface CropVariantRow {
  id: string
  commodity_id: string
  name: string
  estimated_bu: number | null
  crop_year: number
}

interface PrecipRow {
  last_7d_in: number | string | null
}

function fmt$(n: number | null): string {
  if (n == null) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`
  return `${sign}$${abs.toFixed(0)}`
}

function pct(num: number, denom: number): number {
  if (denom <= 0) return 0
  return Math.min(100, Math.round((num / denom) * 100))
}

function ProgressBar({ value, max = 100, color = 'accent' }: { value: number; max?: number; color?: string }) {
  const pctVal = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const colorClass =
    color === 'green' ? 'bg-[#7A9E7E]' :
    color === 'amber' ? 'bg-amber-500' :
    color === 'red' ? 'bg-red-500' :
    'bg-glomalin-accent'
  return (
    <div className="h-1.5 w-full rounded-full bg-glomalin-border overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${colorClass}`}
        style={{ width: `${pctVal}%` }}
      />
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  accent = false,
  warn = false,
}: {
  label: string
  value: string
  sub?: string
  accent?: boolean
  warn?: boolean
}) {
  return (
    <div className="bg-glomalin-surface border border-glomalin-border rounded p-4">
      <p className="text-[11px] font-mono text-glomalin-muted uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-mono font-semibold ${warn ? 'text-amber-400' : accent ? 'text-glomalin-accent' : 'text-glomalin-text'}`}>
        {value}
      </p>
      {sub && <p className="text-xs font-mono text-glomalin-muted mt-1">{sub}</p>}
    </div>
  )
}

export default async function PerformancePage({
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
  const showFinancials = role === 'admin' || role === 'agronomist'

  const [
    budgetResult,
    settlementResult,
    cluTotalResult,
    cluReportedResult,
    insuranceAtRiskResult,
    openClaimsResult,
    variantsResult,
    instrumentsResult,
    precipResult,
  ] = await Promise.allSettled([
    fetchBudgetService('/api/budget-field-details'),
    fetchGrainService(`/api/settlement-summary?cropYear=${cropYear}`),
    supabase.from('clu_records').select('id', { count: 'exact', head: true }).eq('crop_year', cropYear),
    supabase.from('clu_records').select('id', { count: 'exact', head: true }).eq('crop_year', cropYear).eq('reported', true),
    supabase.from('insurance_policies').select('id', { count: 'exact', head: true }).eq('policy_year', cropYear).eq('claim_alert', 'potential'),
    supabase.from('claims').select('id', { count: 'exact', head: true }).not('stage', 'in', '(closed,denied)'),
    supabase.from('crop_variants').select('id, commodity_id, name, estimated_bu, crop_year').eq('crop_year', cropYear),
    supabase.from('sale_instruments').select('*').eq('crop_year', cropYear),
    supabase.from('precip_summary').select('last_7d_in'),
  ])

  let budgetFields: BudgetField[] = []
  let budgetOffline = false
  if (budgetResult.status === 'fulfilled') {
    try {
      const res = budgetResult.value
      if (res.ok) {
        const data = await res.json() as { fields?: BudgetField[] }
        budgetFields = (data.fields ?? []).filter(f => f.acres > 0)
      } else {
        budgetOffline = true
      }
    } catch {
      budgetOffline = true
    }
  } else {
    budgetOffline = true
  }

  let settlementRows: SettlementRow[] = []
  let settlementOffline = false
  if (settlementResult.status === 'fulfilled') {
    try {
      const res = settlementResult.value
      if (res.ok) {
        const data = await res.json() as { summary?: SettlementRow[] }
        settlementRows = data.summary ?? []
      } else {
        settlementOffline = true
      }
    } catch {
      settlementOffline = true
    }
  } else {
    settlementOffline = true
  }

  const totalAcres = budgetFields.reduce((s, f) => s + f.acres, 0)
  const totalInputCost = budgetFields.reduce((s, f) => s + f.expPerAcre * f.acres, 0)
  const totalSettledRevenue = settlementRows.reduce((s, r) => s + r.netPayment, 0)
  const grossMargin = !budgetOffline && !settlementOffline && settlementRows.length > 0
    ? totalSettledRevenue - totalInputCost
    : null

  const cluTotal: number = cluTotalResult.status === 'fulfilled' ? (cluTotalResult.value.count ?? 0) : 0
  const cluReported: number = cluReportedResult.status === 'fulfilled' ? (cluReportedResult.value.count ?? 0) : 0
  const insuranceAtRisk: number = insuranceAtRiskResult.status === 'fulfilled' ? (insuranceAtRiskResult.value.count ?? 0) : 0
  const openClaims: number = openClaimsResult.status === 'fulfilled' ? (openClaimsResult.value.count ?? 0) : 0

  const variants: CropVariantRow[] = variantsResult.status === 'fulfilled'
    ? ((variantsResult.value.data ?? []) as CropVariantRow[])
    : []
  const instruments: SaleInstrument[] = instrumentsResult.status === 'fulfilled'
    ? ((instrumentsResult.value.data ?? []) as SaleInstrument[])
    : []

  const instrumentsByCommodity = new Map<string, SaleInstrument[]>()
  for (const inst of instruments) {
    const key = inst.commodity_id
    if (!instrumentsByCommodity.has(key)) instrumentsByCommodity.set(key, [])
    instrumentsByCommodity.get(key)!.push(inst)
  }

  interface CommodityPosition {
    commodityId: string
    name: string
    estimatedBu: number
    pricedBu: number
    pctPriced: number
  }

  const commodityPositions: CommodityPosition[] = []
  const commoditySeen = new Set<string>()
  for (const v of variants) {
    const cid = v.commodity_id
    if (!commoditySeen.has(cid)) {
      commoditySeen.add(cid)
      const relatedVariants = variants.filter(vv => vv.commodity_id === cid)
      const relatedInstruments = instrumentsByCommodity.get(cid) ?? []
      const totalEst = relatedVariants.reduce((s, vv) => s + (vv.estimated_bu ?? 0), 0)
      const totalPriced = relatedInstruments.reduce((s, i) => s + instrumentPricedBu(i), 0)
      const firstName = relatedVariants[0]?.name ?? cid
      commodityPositions.push({
        commodityId: cid,
        name: firstName,
        estimatedBu: totalEst,
        pricedBu: Math.min(totalPriced, totalEst),
        pctPriced: pct(totalPriced, totalEst),
      })
    }
  }

  const overallEstBu = commodityPositions.reduce((s, c) => s + c.estimatedBu, 0)
  const overallPricedBu = commodityPositions.reduce((s, c) => s + c.pricedBu, 0)
  const overallPctPriced = pct(overallPricedBu, overallEstBu)

  const precipRows: PrecipRow[] = precipResult.status === 'fulfilled'
    ? ((precipResult.value.data ?? []) as PrecipRow[])
    : []
  const precipValues = precipRows
    .map(r => r.last_7d_in != null ? Number(r.last_7d_in) : null)
    .filter((v): v is number => v != null && !isNaN(v))
  const avgPrecip7d = precipValues.length > 0
    ? precipValues.reduce((s, v) => s + v, 0) / precipValues.length
    : null

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const cluPct = pct(cluReported, cluTotal)

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-mono font-semibold text-glomalin-text mb-1">Farm Performance</h1>
          <p className="text-sm font-mono text-glomalin-muted">{cropYear} season · {today}</p>
        </div>
        <YearSelector currentYear={cropYear} />
      </div>

      {budgetOffline && (
        <div className="mb-4 px-4 py-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-mono rounded">
          Farm-budget is offline — financial data unavailable
        </div>
      )}

      <div className="space-y-8">
        <section>
          <h2 className="text-xs font-mono font-medium uppercase tracking-widest text-glomalin-muted mb-3">Financial Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Total Acres"
              value={totalAcres > 0 ? totalAcres.toFixed(1) : '—'}
              sub={budgetOffline ? 'farm-budget offline' : undefined}
            />
            {showFinancials && (
              <>
                <StatCard
                  label="Total Input Cost"
                  value={budgetOffline ? '—' : fmt$(totalInputCost)}
                  sub={budgetOffline ? undefined : `${totalAcres > 0 ? `$${(totalInputCost / totalAcres).toFixed(0)}/ac` : ''}`}
                />
                <StatCard
                  label="Settled Revenue"
                  value={settlementOffline || settlementRows.length === 0 ? '—' : fmt$(totalSettledRevenue)}
                  sub={settlementOffline ? 'grain-tickets offline' : settlementRows.length === 0 ? `no ${cropYear} settlements` : undefined}
                />
                <StatCard
                  label="Gross Margin"
                  value={grossMargin == null ? '—' : fmt$(grossMargin)}
                  sub={grossMargin == null ? 'awaiting both services' : grossMargin >= 0 ? 'revenue over cost' : 'cost exceeds revenue'}
                  accent={grossMargin != null && grossMargin >= 0}
                  warn={grossMargin != null && grossMargin < 0}
                />
              </>
            )}
          </div>
        </section>

        {commodityPositions.length > 0 && (
          <section>
            <h2 className="text-xs font-mono font-medium uppercase tracking-widest text-glomalin-muted mb-3">Marketing Status</h2>
            <div className="bg-glomalin-surface border border-glomalin-border rounded overflow-hidden">
              <div className="px-4 py-3 border-b border-glomalin-border flex items-center justify-between">
                <span className="text-xs font-mono text-glomalin-muted">Overall priced</span>
                <span className="text-sm font-mono font-semibold text-glomalin-text">{overallPctPriced}%</span>
              </div>
              <div className="divide-y divide-glomalin-border">
                {commodityPositions.map((pos) => (
                  <div key={pos.commodityId} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-mono text-glomalin-text">{pos.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-glomalin-muted">
                          {pos.pricedBu.toLocaleString()} / {pos.estimatedBu.toLocaleString()} bu
                        </span>
                        <span className="text-sm font-mono font-semibold text-glomalin-accent w-10 text-right">
                          {pos.pctPriced}%
                        </span>
                      </div>
                    </div>
                    <ProgressBar
                      value={pos.pricedBu}
                      max={pos.estimatedBu}
                      color={pos.pctPriced >= 80 ? 'green' : pos.pctPriced >= 40 ? 'accent' : 'amber'}
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section>
          <h2 className="text-xs font-mono font-medium uppercase tracking-widest text-glomalin-muted mb-3">Compliance Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-glomalin-surface border border-glomalin-border rounded p-4">
              <p className="text-[11px] font-mono text-glomalin-muted uppercase tracking-wider mb-2">FSA Reporting</p>
              <p className="text-lg font-mono font-semibold text-glomalin-text mb-2">
                {cluReported} / {cluTotal}
                <span className="text-xs text-glomalin-muted font-normal ml-2">CLUs</span>
              </p>
              <ProgressBar value={cluReported} max={cluTotal} color={cluPct === 100 ? 'green' : 'accent'} />
              <p className="text-xs font-mono text-glomalin-muted mt-2">
                {cluTotal === 0 ? 'No CLUs on record' : cluPct === 100 ? 'All fields reported' : `${cluTotal - cluReported} pending`}
              </p>
            </div>

            <div className="bg-glomalin-surface border border-glomalin-border rounded p-4">
              <p className="text-[11px] font-mono text-glomalin-muted uppercase tracking-wider mb-2">Insurance Alerts</p>
              <p className={`text-lg font-mono font-semibold mb-1 ${insuranceAtRisk > 0 ? 'text-amber-400' : 'text-glomalin-text'}`}>
                {insuranceAtRisk}
                <span className="text-xs text-glomalin-muted font-normal ml-2">policies at risk</span>
              </p>
              {insuranceAtRisk > 0 && (
                <p className="text-xs font-mono text-amber-400 mt-1">Potential claims detected</p>
              )}
              {insuranceAtRisk === 0 && (
                <p className="text-xs font-mono text-glomalin-muted mt-1">No alerts</p>
              )}
            </div>

            <div className="bg-glomalin-surface border border-glomalin-border rounded p-4">
              <p className="text-[11px] font-mono text-glomalin-muted uppercase tracking-wider mb-2">Open Claims</p>
              <p className={`text-lg font-mono font-semibold mb-1 ${openClaims > 0 ? 'text-amber-400' : 'text-glomalin-text'}`}>
                {openClaims}
                <span className="text-xs text-glomalin-muted font-normal ml-2">active</span>
              </p>
              {openClaims === 0 && (
                <p className="text-xs font-mono text-glomalin-muted mt-1">No open claims</p>
              )}
              {openClaims > 0 && (
                <p className="text-xs font-mono text-amber-400 mt-1">In progress</p>
              )}
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-mono font-medium uppercase tracking-widest text-glomalin-muted mb-3">Field Conditions</h2>
          <div className="bg-glomalin-surface border border-glomalin-border rounded p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-mono text-glomalin-muted uppercase tracking-wider">Avg Precip — Last 7 Days</p>
              <p className="text-xl font-mono font-semibold text-glomalin-text">
                {avgPrecip7d != null ? `${avgPrecip7d.toFixed(2)}"` : '—'}
              </p>
            </div>
            {avgPrecip7d != null && avgPrecip7d > 1 && (
              <p className="text-xs font-mono text-amber-400 mt-2">
                Wet conditions — monitor field access
              </p>
            )}
            {avgPrecip7d != null && avgPrecip7d < 0.1 && (
              <p className="text-xs font-mono text-amber-400 mt-2">
                Dry stretch — watch for drought stress
              </p>
            )}
            {avgPrecip7d == null && (
              <p className="text-xs font-mono text-glomalin-muted mt-2">
                No precip data on record
              </p>
            )}
            {precipValues.length > 0 && (
              <p className="text-xs font-mono text-glomalin-muted mt-1">
                Averaged across {precipValues.length} field{precipValues.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-xs font-mono font-medium uppercase tracking-widest text-glomalin-muted mb-3">Detail</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <Link
              href="/app/enterprise-summary"
              className="flex items-center gap-2 px-4 py-2.5 bg-glomalin-surface border border-glomalin-border rounded text-sm font-mono text-glomalin-muted hover:text-glomalin-text hover:border-glomalin-accent/50 transition-colors"
            >
              <span className="text-glomalin-accent">→</span> Enterprise Summary
            </Link>
            <Link
              href="/app/marketing"
              className="flex items-center gap-2 px-4 py-2.5 bg-glomalin-surface border border-glomalin-border rounded text-sm font-mono text-glomalin-muted hover:text-glomalin-text hover:border-glomalin-accent/50 transition-colors"
            >
              <span className="text-glomalin-accent">→</span> Marketing
            </Link>
            <Link
              href="/app/compliance"
              className="flex items-center gap-2 px-4 py-2.5 bg-glomalin-surface border border-glomalin-border rounded text-sm font-mono text-glomalin-muted hover:text-glomalin-text hover:border-glomalin-accent/50 transition-colors"
            >
              <span className="text-glomalin-accent">→</span> Compliance
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
