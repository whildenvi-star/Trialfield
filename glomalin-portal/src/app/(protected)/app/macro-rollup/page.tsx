import { createClient } from '@/lib/supabase/server'
import { CropComparison } from '@/components/macro/crop-comparison'

const OPEN_STAGES = ['notice_of_loss', 'filed', 'adjuster_assigned', 'under_review']

const STAGE_LABELS: Record<string, string> = {
  notice_of_loss: 'Notice of Loss',
  filed: 'Filed',
  adjuster_assigned: 'Adjuster Assigned',
  under_review: 'Under Review',
  settled: 'Settled',
  closed: 'Closed',
}

function fmtAcres(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function fmtDollars(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
}

type Row = Record<string, unknown>

export default async function MacroRollupPage() {
  const supabase = await createClient()

  const [cluRes, policiesRes, claimsRes, gcsRes] = await Promise.all([
    supabase.from('clu_records').select('*'),
    supabase.from('insurance_policies').select('*'),
    supabase.from('claims').select('*').order('created_at', { ascending: false }),
    supabase.from('gcs_enrollments').select('*'),
  ])

  const clus = (cluRes.data ?? []) as Row[]
  const policies = (policiesRes.data ?? []) as Row[]
  const claims = (claimsRes.data ?? []) as Row[]
  const gcs = (gcsRes.data ?? []) as Row[]

  // ── Stat card computations ──
  const totalAcres = clus.reduce((s, r) => s + (Number(r.fsa_acres) || 0), 0)
  const organicAcres = clus.filter((r) => r.organic).reduce((s, r) => s + (Number(r.fsa_acres) || 0), 0)
  const insuredAcres = policies.reduce((s, r) => s + (Number(r.planted_acres) || 0), 0)
  const openClaims = claims.filter((c) => OPEN_STAGES.includes(c.stage as string)).length

  // ── Crop rollup ──
  const cropMap = new Map<string, { total: number; organic: number; irrigated: number; count: number }>()
  for (const r of clus) {
    const crop = (r.crop as string) || 'Unknown'
    const ac = Number(r.fsa_acres) || 0
    const prev = cropMap.get(crop) ?? { total: 0, organic: 0, irrigated: 0, count: 0 }
    prev.total += ac
    if (r.organic) prev.organic += ac
    if (r.irrigated) prev.irrigated += ac
    prev.count += 1
    cropMap.set(crop, prev)
  }
  const cropRows = Array.from(cropMap.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .map(([crop, d]) => ({ crop, ...d }))

  // ── Farm rollup ──
  const farmMap = new Map<string, { name: string; total: number; organic: number; dry: number; irrigated: number }>()
  for (const r of clus) {
    const fn = (r.farm_number as string) || 'Unknown'
    const ac = Number(r.fsa_acres) || 0
    const prev = farmMap.get(fn) ?? { name: (r.farm_name as string) || fn, total: 0, organic: 0, dry: 0, irrigated: 0 }
    prev.total += ac
    if (r.organic) prev.organic += ac
    if (r.irrigated) prev.irrigated += ac
    else prev.dry += ac
    farmMap.set(fn, prev)
  }
  const farmRows = Array.from(farmMap.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .map(([fn, d]) => ({ farmNumber: fn, ...d }))

  // ── GCS totals ──
  const cc340 = gcs.reduce((s, r) => s + (Number(r.cc340_acres) || 0), 0)
  const rt345 = gcs.reduce((s, r) => s + (Number(r.rt345_acres) || 0), 0)
  const nt329 = gcs.reduce((s, r) => s + (Number(r.nt329_acres) || 0), 0)

  return (
    <div className="min-h-screen bg-glomalin-bg text-glomalin-text">
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-mono font-semibold text-glomalin-text">Field Summary</h1>
          <p className="mt-1 text-sm text-glomalin-muted font-mono">Whole-farm overview across all modules</p>
        </div>

        {/* Top stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          <StatCard label="Total Acres" value={fmtAcres(totalAcres)} />
          <StatCard label="Organic Acres" value={fmtAcres(organicAcres)} color="green" />
          <StatCard label="Insured Acres" value={fmtAcres(insuredAcres)} />
          <StatCard label="Open Claims" value={String(openClaims)} color={openClaims > 0 ? 'accent' : undefined} />
        </div>

        {/* Acreage by Crop */}
        <Section title="Acreage by Crop">
          {cropRows.length === 0 ? (
            <EmptyState text="No CLU records found." />
          ) : (
            <Table
              headers={['Crop', 'Total Acres', 'Organic', 'Irrigated', 'Fields']}
              alignRight={[1, 2, 3, 4]}
              rows={cropRows.map((r) => [
                r.crop,
                fmtAcres(r.total),
                fmtAcres(r.organic),
                fmtAcres(r.irrigated),
                String(r.count),
              ])}
            />
          )}
        </Section>

        {/* Farm Summary */}
        <Section title="Farm Summary">
          {farmRows.length === 0 ? (
            <EmptyState text="No farm data found." />
          ) : (
            <Table
              headers={['Farm', 'Total Acres', 'Organic', 'Dry', 'Irrigated']}
              alignRight={[1, 2, 3, 4]}
              rows={farmRows.map((r) => [
                r.name,
                fmtAcres(r.total),
                fmtAcres(r.organic),
                fmtAcres(r.dry),
                fmtAcres(r.irrigated),
              ])}
            />
          )}
        </Section>

        {/* Insurance Coverage */}
        <Section title="Insurance Coverage">
          {policies.length === 0 ? (
            <EmptyState text="No insurance policies found." />
          ) : (
            <Table
              headers={['Crop', 'Planted Acres', 'Coverage', 'Guarantee', 'Premium/ac', 'Alert']}
              alignRight={[1, 2, 3, 4]}
              rows={policies.map((p) => [
                (p.crop as string) || '—',
                fmtAcres(Number(p.planted_acres) || 0),
                typeof p.coverage_level === 'number' ? `${p.coverage_level}%` : '—',
                fmtDollars(p.guarantee as number | null),
                fmtDollars(p.premium_per_acre as number | null),
                (p.claim_alert as string) === 'potential'
                  ? 'Potential'
                  : '—',
              ])}
            />
          )}
        </Section>

        {/* Claims Status */}
        <Section title="Claims Status">
          {claims.length === 0 ? (
            <EmptyState text="No claims filed." />
          ) : (
            <Table
              headers={['Crop', 'Stage', 'Coverage', 'Deadline', 'Eff. Guarantee']}
              alignRight={[4]}
              rows={claims.map((c) => {
                const stage = c.stage as string
                const isOpen = OPEN_STAGES.includes(stage)
                return [
                  (c.crop as string) || '—',
                  `${isOpen ? '\u25CF ' : ''}${STAGE_LABELS[stage] ?? stage}`,
                  `${(c.coverage_type as string) ?? '—'}${typeof c.coverage_level === 'number' ? ` ${c.coverage_level}%` : ''}`,
                  fmtDate(c.deadline_at as string | null),
                  fmtDollars(c.effective_guarantee as number | null),
                ]
              })}
            />
          )}
        </Section>

        {/* Conservation Programs */}
        <Section title="Conservation Programs">
          {gcs.length === 0 ? (
            <EmptyState text="No GCS enrollment data." />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label="CC-340 Acres" value={fmtAcres(cc340)} color="green" />
              <StatCard label="RT-345 Acres" value={fmtAcres(rt345)} color="green" />
              <StatCard label="NT-329 Acres" value={fmtAcres(nt329)} color="green" />
              <StatCard label="Total Enrollments" value={String(gcs.length)} />
            </div>
          )}
        </Section>

        {/* Crop Comparison Sandbox */}
        <Section title="Crop Comparison">
          <CropComparison
            farms={farmRows.map((f) => ({
              farmNumber: f.farmNumber,
              name: f.name,
              totalAcres: f.total,
            }))}
          />
        </Section>

      </div>
    </div>
  )
}

// ── Reusable sub-components ──

function StatCard({ label, value, color }: { label: string; value: string; color?: 'green' | 'accent' }) {
  const valueColor =
    color === 'green' ? 'text-glomalin-green' : color === 'accent' ? 'text-glomalin-accent' : 'text-glomalin-text'
  return (
    <div className="rounded border border-glomalin-border bg-glomalin-surface px-5 py-4">
      <p className="text-xs text-glomalin-muted font-mono uppercase tracking-wider">{label}</p>
      <p className={`mt-1 text-3xl font-mono font-semibold ${valueColor}`}>{value}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h2 className="text-lg font-mono font-semibold text-glomalin-text mb-4">{title}</h2>
      {children}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded border border-glomalin-border bg-glomalin-surface px-6 py-8 text-center">
      <p className="text-glomalin-muted font-mono text-sm">{text}</p>
    </div>
  )
}

function Table({ headers, rows, alignRight = [] }: { headers: string[]; rows: string[][]; alignRight?: number[] }) {
  const rightSet = new Set(alignRight)
  return (
    <div className="rounded border border-glomalin-border overflow-hidden">
      <table className="w-full text-sm font-mono">
        <thead className="bg-glomalin-surface border-b border-glomalin-border">
          <tr>
            {headers.map((h, i) => (
              <th
                key={h}
                className={`${rightSet.has(i) ? 'text-right' : 'text-left'} px-4 py-3 text-glomalin-muted font-normal text-xs uppercase tracking-wider`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-glomalin-border">
          {rows.map((row, ri) => (
            <tr key={ri} className="bg-glomalin-bg hover:bg-glomalin-surface transition-colors">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`px-4 py-3 ${rightSet.has(ci) ? 'text-right' : ''} text-glomalin-text`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
