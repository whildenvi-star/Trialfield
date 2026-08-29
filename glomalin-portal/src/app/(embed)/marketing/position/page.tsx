// Marketing position widget — chrome-less embed for the MACRO dashboard.
// Sales vs projected for the four primary crops (Shell Corn, Non-GMO Yellow
// Corn, RR Soybeans, Food Beans — which pools High Oil Soybeans) plus
// one-line quick info on the specialty crops. Owners additionally get a
// WAP · COP line per crop; office rows arrive with financial keys stripped
// server-side, so that line simply never renders for them.
//
// Theming: MACRO passes ?theme=light|dark to match its own mode. Light is
// the default (MACRO defaults white for readability).
import { redirect } from 'next/navigation'
import { getMarketingAuthContext } from '@/lib/supabase/marketing-guard-rsc'
import { loadEnterpriseData } from '@/lib/marketing/load-enterprise-data'
import type { OfficeCommodityRollupRow, VariantRollupRow } from '@/lib/marketing/enterprise-rollup'
import { formatBu, formatPct, formatPricePerBu } from '@/lib/fmt'
import { CURRENT_CROP_YEAR } from '@/lib/config'

// Office rows omit the financial keys, owner rows carry them — model both.
type VariantVolume = OfficeCommodityRollupRow['variants'][number] &
  Partial<Pick<VariantRollupRow, 'wapCents' | 'copPerBu'>>

// crosswalk variantName(s) → one widget card; volumes are summed across them
const PRIMARY: Array<{ variants: string[]; label: string }> = [
  { variants: ['Shell Corn'], label: 'Shell Corn' },
  { variants: ['Non-GMO Yellow Corn'], label: 'Non-GMO Corn' },
  { variants: ['Soybeans'], label: 'RR Soybeans' },
  { variants: ['Non-GMO Food Beans', 'High Oil Soybeans'], label: 'Food Beans' },
]

interface Pooled {
  soldBu: number
  projectedBu: number | null
  actualBu: number | null
  pctSold: number | null
  /** sold-bushel-weighted avg sale price, cents/bu; null when nothing priced or office */
  wapCents: number | null
  /** projected-bushel-weighted cost of production, $/bu; null when no budget or office */
  copPerBu: number | null
}

function pool(variants: VariantVolume[]): Pooled | null {
  if (variants.length === 0) return null
  const soldBu = variants.reduce((s, v) => s + v.soldBu, 0)
  const projs = variants.filter((v) => v.projectedBu != null)
  const projectedBu = projs.length ? projs.reduce((s, v) => s + (v.projectedBu ?? 0), 0) : null
  const acts = variants.filter((v) => v.actualBu != null)
  const actualBu = acts.length ? acts.reduce((s, v) => s + (v.actualBu ?? 0), 0) : null
  const pctSold = projectedBu != null && projectedBu > 0 ? soldBu / projectedBu : null

  // WAP across the pool, weighted by each variant's sold bu (wapCents === 0
  // means nothing priced — same convention as the enterprise table). Falls
  // back to a plain average if the priced variants have no sold volume.
  const priced = variants.filter((v) => (v.wapCents ?? 0) > 0)
  const pricedSold = priced.reduce((s, v) => s + v.soldBu, 0)
  const wapCents = priced.length
    ? pricedSold > 0
      ? priced.reduce((s, v) => s + (v.wapCents as number) * v.soldBu, 0) / pricedSold
      : priced.reduce((s, v) => s + (v.wapCents as number), 0) / priced.length
    : null

  // COP weighted by projected bu — mirrors the commodity-level roll-up.
  const budgeted = variants.filter((v) => v.copPerBu != null && (v.projectedBu ?? 0) > 0)
  const budgetedProj = budgeted.reduce((s, v) => s + (v.projectedBu as number), 0)
  const copPerBu = budgeted.length && budgetedProj > 0
    ? budgeted.reduce((s, v) => s + (v.copPerBu as number) * (v.projectedBu as number), 0) / budgetedProj
    : null

  return { soldBu, projectedBu, actualBu, pctSold, wapCents, copPerBu }
}

function barColor(pct: number | null): string {
  if (pct == null) return 'var(--w-border)'
  if (pct >= 0.8) return 'var(--w-ok)'
  if (pct >= 0.5) return 'var(--w-warn)'
  return 'var(--w-bad)'
}

const WIDGET_CSS = `
  .mpw { --w-bg: transparent; --w-surface: #ffffff; --w-border: #cbd5e1;
    --w-text: #1e293b; --w-muted: #475569; --w-bright: #0f172a;
    --w-accent: #0d9488; --w-ok: #0d9488; --w-warn: #b8860b; --w-bad: #c62828;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    background: var(--w-bg); color: var(--w-text); padding: 12px; }
  .mpw[data-theme="dark"] { --w-surface: #10141c; --w-border: #2a3242;
    --w-text: #c7d0de; --w-muted: #8593a8; --w-bright: #eef2f8;
    --w-accent: #2dd4bf; --w-ok: #2dd4bf; --w-warn: #e8b339; --w-bad: #ef6a5a; }
  .mpw-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 10px; }
  .mpw-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: var(--w-muted); }
  .mpw-link { font-size: 12px; color: var(--w-muted); text-decoration: none; }
  .mpw-link:hover { color: var(--w-accent); }
  .mpw-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  @media (min-width: 1100px) { .mpw-grid { grid-template-columns: repeat(4, 1fr); } }
  .mpw-card { border: 1px solid var(--w-border); background: var(--w-surface); border-radius: 4px; padding: 10px 12px; }
  .mpw-crop { font-size: 14px; font-weight: 700; color: var(--w-bright); margin-bottom: 6px; }
  .mpw-bar { height: 7px; border-radius: 4px; background: color-mix(in srgb, var(--w-border) 55%, transparent); overflow: hidden; }
  .mpw-fill { height: 100%; border-radius: 4px; }
  .mpw-nums { margin-top: 6px; font-size: 13px; color: var(--w-muted); font-variant-numeric: tabular-nums; }
  .mpw-nums b { color: var(--w-text); font-weight: 600; }
  .mpw-actual { color: var(--w-muted); opacity: 0.85; }
  .mpw-fin { margin-top: 4px; font-size: 13px; color: var(--w-muted); font-variant-numeric: tabular-nums; }
  .mpw-fin b { color: var(--w-text); font-weight: 600; }
  .mpw-fin .below { color: var(--w-bad); }
  .mpw-spec { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px 20px; font-size: 12.5px; color: var(--w-muted); font-variant-numeric: tabular-nums; }
  .mpw-spec b { color: var(--w-text); font-weight: 600; }
`

export default async function MarketingPositionEmbedPage({
  searchParams,
}: {
  searchParams: { theme?: string }
}) {
  const ctx = await getMarketingAuthContext()
  if (!ctx) redirect('/login')

  const theme = searchParams?.theme === 'dark' ? 'dark' : 'light'
  const { role, accessToken } = ctx
  const enterprise = await loadEnterpriseData(accessToken, role, CURRENT_CROP_YEAR)

  const allVariants: VariantVolume[] = enterprise.rows.flatMap(
    (r) => r.variants as VariantVolume[]
  )
  const byName = new Map(allVariants.map((v) => [v.variantName, v]))

  const primaryNames = new Set(PRIMARY.flatMap((p) => p.variants))
  const specialty = allVariants.filter(
    (v) => !primaryNames.has(v.variantName) && (v.soldBu > 0 || (v.projectedBu ?? 0) > 0)
  )

  // The portal's root layout paints a dark body; the iframe document must be
  // repainted per theme or the widget sits on a black background.
  const bodyCss =
    theme === 'dark'
      ? 'html,body{background:#0b0e14 !important;}'
      : 'html,body{background:#eef1f5 !important;}'

  return (
    <div className="mpw" data-theme={theme}>
      <style>{bodyCss + WIDGET_CSS}</style>
      <div className="mpw-head">
        <span className="mpw-title">Marketing Position · {CURRENT_CROP_YEAR}</span>
        <a className="mpw-link" href="/app/marketing" target="_top">
          full command center →
        </a>
      </div>

      {/* Primary four: sales vs projected */}
      <div className="mpw-grid">
        {PRIMARY.map(({ variants, label }) => {
          const pooled = pool(variants.map((n) => byName.get(n)).filter(Boolean) as VariantVolume[])
          const pct = pooled?.pctSold != null ? Math.min(1, pooled.pctSold) : null
          return (
            <div key={label} className="mpw-card">
              <div className="mpw-crop">{label}</div>
              <div className="mpw-bar">
                <div
                  className="mpw-fill"
                  style={{
                    width: `${pct != null ? Math.round(pct * 100) : 0}%`,
                    background: barColor(pct),
                  }}
                />
              </div>
              <div className="mpw-nums">
                {pooled ? (
                  pooled.projectedBu != null ? (
                    <>
                      <b>{formatBu(pooled.soldBu)}</b> / {formatBu(Math.round(pooled.projectedBu))} bu
                      {' '}· <b>{pooled.pctSold != null ? formatPct(pooled.pctSold) : '—'}</b> sold
                    </>
                  ) : (
                    <>{formatBu(pooled.soldBu)} bu sold · no crop plan</>
                  )
                ) : (
                  <>no data</>
                )}
                {pooled?.actualBu != null && (
                  <span className="mpw-actual"> · actual {formatBu(Math.round(pooled.actualBu))}</span>
                )}
              </div>
              {(pooled?.wapCents != null || pooled?.copPerBu != null) && (
                <div className="mpw-fin">
                  WAP{' '}
                  <b
                    className={
                      pooled.wapCents != null && pooled.copPerBu != null &&
                      pooled.wapCents / 100 < pooled.copPerBu
                        ? 'below'
                        : undefined
                    }
                  >
                    {pooled.wapCents != null ? formatPricePerBu(pooled.wapCents / 100) : '—'}
                  </b>
                  {' '}· COP <b>{pooled.copPerBu != null ? formatPricePerBu(pooled.copPerBu) : '—'}</b>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Specialty crops: quick info one-liners */}
      {specialty.length > 0 && (
        <div className="mpw-spec">
          {specialty.map((v) => (
            <span key={v.variantName}>
              <b>{v.variantName}</b> {formatBu(v.soldBu)}
              {v.projectedBu != null && <>/{formatBu(Math.round(v.projectedBu))}</>} bu
              {v.pctSold != null && <> · {formatPct(v.pctSold)}</>}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
