// Marketing position widget — chrome-less embed for the MACRO dashboard.
// Sales vs projected for the four primary crops (Shell Corn, Non-GMO Yellow
// Corn, RR Soybeans, Food Beans) plus one-line quick info on the specialty
// crops. A trimmed-down PoolCard: volumes only, so office and owner render
// identically (financial keys are stripped server-side for office anyway).
import { redirect } from 'next/navigation'
import { getMarketingAuthContext } from '@/lib/supabase/marketing-guard-rsc'
import { loadEnterpriseData } from '@/lib/marketing/load-enterprise-data'
import type { OfficeCommodityRollupRow } from '@/lib/marketing/enterprise-rollup'
import { formatBu, formatPct } from '@/lib/fmt'
import { CURRENT_CROP_YEAR } from '@/lib/config'

type VariantVolume = OfficeCommodityRollupRow['variants'][number]

// variantName in the enterprise crosswalk → display label on the widget
const PRIMARY: Array<{ variant: string; label: string }> = [
  { variant: 'Shell Corn', label: 'Shell Corn' },
  { variant: 'Non-GMO Yellow Corn', label: 'Non-GMO Corn' },
  { variant: 'Soybeans', label: 'RR Soybeans' },
  { variant: 'Non-GMO Food Beans', label: 'Food Beans' },
]

function barColor(pct: number | null): string {
  if (pct == null) return 'bg-glomalin-border'
  if (pct >= 0.8) return 'bg-glomalin-success'
  if (pct >= 0.5) return 'bg-glomalin-warning'
  return 'bg-glomalin-danger'
}

export default async function MarketingPositionEmbedPage() {
  const ctx = await getMarketingAuthContext()
  if (!ctx) redirect('/login')

  const { role, accessToken } = ctx
  const enterprise = await loadEnterpriseData(accessToken, role, CURRENT_CROP_YEAR)

  const allVariants: VariantVolume[] = enterprise.rows.flatMap(
    (r) => r.variants as VariantVolume[]
  )
  const byName = new Map(allVariants.map((v) => [v.variantName, v]))

  const primaryNames = new Set(PRIMARY.map((p) => p.variant))
  const specialty = allVariants.filter(
    (v) => !primaryNames.has(v.variantName) && (v.soldBu > 0 || (v.projectedBu ?? 0) > 0)
  )

  return (
    <div className="p-3 bg-transparent">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-glomalin-muted">
          Marketing Position · {CURRENT_CROP_YEAR}
        </span>
        <a
          href="/app/marketing"
          target="_top"
          className="text-[10px] font-mono text-glomalin-muted hover:text-glomalin-accent"
        >
          full command center →
        </a>
      </div>

      {/* Primary four: sales vs projected */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
        {PRIMARY.map(({ variant, label }) => {
          const v = byName.get(variant)
          const pct = v?.pctSold != null ? Math.min(1, v.pctSold) : null
          return (
            <div
              key={variant}
              className="rounded border border-glomalin-border bg-glomalin-surface px-2.5 py-2"
            >
              <div className="text-[11px] font-mono font-semibold text-glomalin-bright mb-1">
                {label}
              </div>
              <div className="h-1 rounded-full bg-glomalin-border/60 overflow-hidden">
                <div
                  className={`h-full rounded-full ${barColor(pct)}`}
                  style={{ width: `${pct != null ? Math.round(pct * 100) : 0}%` }}
                />
              </div>
              <div className="mt-1 text-[10px] font-mono text-glomalin-muted tabular-nums">
                {v ? (
                  v.projectedBu != null ? (
                    <>
                      {formatBu(v.soldBu)} / {formatBu(Math.round(v.projectedBu))} bu
                      {' '}· {v.pctSold != null ? formatPct(v.pctSold) : '—'} sold
                    </>
                  ) : (
                    <>{formatBu(v.soldBu)} bu sold · no crop plan</>
                  )
                ) : (
                  <>no data</>
                )}
                {v?.actualBu != null && (
                  <span className="ml-1.5 text-glomalin-muted/70">
                    actual {formatBu(Math.round(v.actualBu))}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Specialty crops: quick info one-liners */}
      {specialty.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-glomalin-muted tabular-nums">
          {specialty.map((v) => (
            <span key={v.variantName}>
              <span className="text-glomalin-text">{v.variantName}</span>{' '}
              {formatBu(v.soldBu)}
              {v.projectedBu != null && <>/{formatBu(Math.round(v.projectedBu))}</>} bu
              {v.pctSold != null && <> · {formatPct(v.pctSold)}</>}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
