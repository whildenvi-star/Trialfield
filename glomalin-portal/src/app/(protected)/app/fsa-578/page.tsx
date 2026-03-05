import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

interface CluRecord {
  fsa_acres: number
  crop: string | null
  reported: boolean
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

export default async function FsaPage() {
  const supabase = await createClient()

  const { data: records, error } = await supabase
    .from('clu_records')
    .select('fsa_acres, crop, reported')
    .eq('crop_year', 2026)

  const cluRecords: CluRecord[] = records ?? []

  const totalCount = cluRecords.length
  const totalAcres = cluRecords.reduce((s, r) => s + (r.fsa_acres || 0), 0)
  const cropsAssigned = cluRecords.filter((r) => r.crop && r.crop.trim() !== '').length
  const unreported = cluRecords.filter((r) => !r.reported).length

  const stats = [
    { label: 'CLU Records', value: totalCount.toLocaleString() },
    { label: 'Total Acres', value: formatNumber(totalAcres) },
    { label: 'Crops Assigned', value: cropsAssigned.toLocaleString() },
    { label: 'Unreported', value: unreported.toLocaleString() },
  ]

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-2xl font-mono font-bold text-soil-text tracking-wide">
          FSA 578 &mdash; Acreage Reporting
        </h1>
        <p className="text-soil-muted font-mono text-sm mt-2">
          Crop year 2026 &middot; Rock County, WI
        </p>
      </div>

      {/* Stat cards — 2x2 grid */}
      {error ? (
        <div className="bg-soil-surface border border-soil-border rounded-lg p-6 text-soil-muted font-mono text-sm">
          Unable to load CLU records. {error.message}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-soil-surface border border-soil-border rounded-lg p-6"
            >
              <p className="text-soil-muted font-mono text-xs uppercase tracking-widest mb-2">
                {stat.label}
              </p>
              <p className="text-soil-accent font-mono text-3xl font-bold">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Back link */}
      <div className="mt-10">
        <Link
          href="/dashboard"
          className="text-sm font-mono text-soil-muted hover:text-soil-accent transition-colors"
        >
          &larr; Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
