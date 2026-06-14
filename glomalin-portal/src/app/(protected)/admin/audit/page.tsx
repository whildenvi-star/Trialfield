import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

interface AuditEntry {
  id: string
  table: string
  label: string
  timestamp: string
  detail: string
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const TABLE_BADGE: Record<string, { label: string; color: string }> = {
  clu:       { label: 'CLU',       color: 'bg-teal-900/60 text-teal-300 border border-teal-700/50' },
  insurance: { label: 'Insurance', color: 'bg-blue-900/60 text-blue-300 border border-blue-700/50' },
  aph:       { label: 'APH',       color: 'bg-green-900/60 text-[#7A9E7E] border border-green-700/50' },
  claim:     { label: 'Claim',     color: 'bg-amber-900/60 text-amber-300 border border-amber-700/50' },
  event:     { label: 'Event',     color: 'bg-[#1e293b]/80 text-[#64748b] border border-[#1e293b]' },
}

async function getAuditEntries(supabase: Awaited<ReturnType<typeof createClient>>): Promise<AuditEntry[]> {
  const [cluRes, policyRes, aphRes, claimsRes, timelineRes] = await Promise.all([
    supabase
      .from('clu_records')
      .select('id, crop_year, farm_number, tract, clu_number, reported, updated_at')
      .order('updated_at', { ascending: false })
      .limit(20),
    supabase
      .from('insurance_policies')
      .select('id, crop, policy_year, farm_name, claim_alert, updated_at')
      .order('updated_at', { ascending: false })
      .limit(20),
    supabase
      .from('aph_records')
      .select('id, crop_year, actual_yield, updated_at, insurance_policies(crop)')
      .order('updated_at', { ascending: false })
      .limit(20),
    supabase
      .from('claims')
      .select('id, stage, crop, farm_name, date_of_loss, updated_at')
      .order('updated_at', { ascending: false })
      .limit(20),
    supabase
      .from('claim_timeline')
      .select('id, claim_id, event_type, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const entries: AuditEntry[] = []

  for (const row of cluRes.data ?? []) {
    entries.push({
      id: `clu-${row.id}`,
      table: 'clu',
      label: `CLU ${row.farm_number}/${row.tract}/${row.clu_number} (${row.crop_year})`,
      timestamp: row.updated_at,
      detail: row.reported ? 'Reported' : 'Not reported',
    })
  }

  for (const row of policyRes.data ?? []) {
    entries.push({
      id: `policy-${row.id}`,
      table: 'insurance',
      label: `Policy: ${row.farm_name} — ${row.crop} (${row.policy_year})`,
      timestamp: row.updated_at,
      detail: `claim_alert: ${row.claim_alert}`,
    })
  }

  for (const row of aphRes.data ?? []) {
    const policy = row.insurance_policies as unknown as { crop: string } | null
    const crop = policy?.crop ?? 'unknown'
    entries.push({
      id: `aph-${row.id}`,
      table: 'aph',
      label: `APH: ${crop} ${row.crop_year}`,
      timestamp: row.updated_at,
      detail: `${row.actual_yield} bu/ac`,
    })
  }

  for (const row of claimsRes.data ?? []) {
    entries.push({
      id: `claim-${row.id}`,
      table: 'claim',
      label: `Claim: ${row.farm_name} — ${row.crop ?? 'crop'}`,
      timestamp: row.updated_at,
      detail: `Stage: ${row.stage}`,
    })
  }

  for (const row of timelineRes.data ?? []) {
    entries.push({
      id: `event-${row.id}`,
      table: 'event',
      label: `Claim event: ${row.event_type}`,
      timestamp: row.created_at,
      detail: `claim ${String(row.claim_id).slice(0, 8)}`,
    })
  }

  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return entries
}

export default async function AuditPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const entries = await getAuditEntries(supabase)

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/admin"
          className="text-glomalin-muted font-mono text-xs hover:text-glomalin-accent transition-colors"
        >
          ← Admin
        </Link>
        <h1 className="mt-3 text-2xl font-bold font-mono text-glomalin-text tracking-wide">
          Audit Log
        </h1>
        <p className="mt-1 text-glomalin-muted font-mono text-sm">
          Recent changes to compliance records
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="border border-glomalin-border rounded bg-glomalin-surface px-6 py-12 text-center">
          <p className="text-glomalin-muted font-mono text-sm">No audit records found</p>
        </div>
      ) : (
        <div className="relative pl-6">
          <div className="absolute left-0 top-0 bottom-0 w-px bg-glomalin-border" />

          <ul className="space-y-4">
            {entries.map((entry) => {
              const badge = TABLE_BADGE[entry.table] ?? TABLE_BADGE['event']
              return (
                <li key={entry.id} className="relative">
                  <div className="absolute -left-[1.375rem] top-3 h-2.5 w-2.5 rounded-full border border-glomalin-border bg-glomalin-bg ring-2 ring-glomalin-bg" />
                  <div className="ml-2 border border-glomalin-border rounded bg-glomalin-surface px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-glomalin-muted font-mono text-xs">
                        {formatTimestamp(entry.timestamp)}
                      </span>
                      <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="font-mono text-sm font-semibold text-glomalin-text">
                      {entry.label}
                    </p>
                    <p className="font-mono text-xs text-glomalin-muted mt-0.5">
                      {entry.detail}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
