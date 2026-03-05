import { createClient } from '@/lib/supabase/server'

// Stage display labels for the claims table
const STAGE_LABELS: Record<string, string> = {
  notice_of_loss: 'Notice of Loss',
  filed: 'Filed',
  adjuster_assigned: 'Adjuster Assigned',
  under_review: 'Under Review',
  settled: 'Settled',
  closed: 'Closed',
}

// Open stages — anything that is not settled or closed
const OPEN_STAGES = ['notice_of_loss', 'filed', 'adjuster_assigned', 'under_review']

// Format a date string as MM/DD/YYYY, or return '—' if null/undefined
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
}

// Format a dollar amount, or return '—' if null/undefined
function formatDollars(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

// Check whether a claim's deadline is within 7 days and not yet closed/settled
function isApproachingDeadline(claim: Record<string, unknown>): boolean {
  if (!claim.deadline_at) return false
  const stage = claim.stage as string
  if (stage === 'closed' || stage === 'settled') return false
  const deadline = new Date(claim.deadline_at as string)
  const now = new Date()
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  return deadline <= sevenDaysFromNow && deadline >= now
}

export default async function ClaimsPage() {
  const supabase = await createClient()

  const { data: claimsData } = await supabase
    .from('claims')
    .select('*')
    .order('created_at', { ascending: false })

  const claims = (claimsData ?? []) as Record<string, unknown>[]

  // Compute stat card values
  const totalClaims = claims.length
  const openClaims = claims.filter((c) => OPEN_STAGES.includes(c.stage as string)).length
  const approachingDeadlines = claims.filter(isApproachingDeadline).length

  return (
    <div className="min-h-screen bg-[#080604] text-[#e8d8c0]">
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-mono font-semibold text-[#e8d8c0]">Claims</h1>
          <p className="mt-1 text-sm text-[#6a5a4a] font-mono">Crop Insurance Claims Tracking</p>
        </div>

        {/* Tracking disclaimer */}
        <div className="mb-6 px-4 py-3 rounded border border-[#2a2218] bg-[#0e0c0b] text-xs text-[#6a5a4a] font-mono">
          This is a tracking tool for producer records. It does not file or submit claims to insurance companies.
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="rounded border border-[#2a2218] bg-[#0e0c0b] px-5 py-4">
            <p className="text-xs text-[#6a5a4a] font-mono uppercase tracking-wider">Total Claims</p>
            <p className="mt-1 text-3xl font-mono font-semibold text-[#e8d8c0]">{totalClaims}</p>
          </div>
          <div className="rounded border border-[#2a2218] bg-[#0e0c0b] px-5 py-4">
            <p className="text-xs text-[#6a5a4a] font-mono uppercase tracking-wider">Open Claims</p>
            <p className="mt-1 text-3xl font-mono font-semibold text-[#7A9E7E]">{openClaims}</p>
          </div>
          <div className="rounded border border-[#2a2218] bg-[#0e0c0b] px-5 py-4">
            <p className="text-xs text-[#6a5a4a] font-mono uppercase tracking-wider">Approaching Deadlines</p>
            <p className={`mt-1 text-3xl font-mono font-semibold ${approachingDeadlines > 0 ? 'text-[#C8860A]' : 'text-[#e8d8c0]'}`}>
              {approachingDeadlines}
            </p>
          </div>
        </div>

        {/* Claims table */}
        {claims.length === 0 ? (
          <div className="rounded border border-[#2a2218] bg-[#0e0c0b] px-6 py-12 text-center">
            <p className="text-[#6a5a4a] font-mono text-sm">No claims yet.</p>
            <p className="mt-2 text-[#6a5a4a] font-mono text-xs">
              Create a claim from an insurance policy to get started.
            </p>
          </div>
        ) : (
          <div className="rounded border border-[#2a2218] overflow-hidden">
            <table className="w-full text-sm font-mono">
              <thead className="bg-[#0e0c0b] border-b border-[#2a2218]">
                <tr>
                  <th className="text-left px-4 py-3 text-[#6a5a4a] font-normal text-xs uppercase tracking-wider">Crop</th>
                  <th className="text-left px-4 py-3 text-[#6a5a4a] font-normal text-xs uppercase tracking-wider">Stage</th>
                  <th className="text-left px-4 py-3 text-[#6a5a4a] font-normal text-xs uppercase tracking-wider">Coverage</th>
                  <th className="text-left px-4 py-3 text-[#6a5a4a] font-normal text-xs uppercase tracking-wider">Date of Loss</th>
                  <th className="text-left px-4 py-3 text-[#6a5a4a] font-normal text-xs uppercase tracking-wider">Deadline</th>
                  <th className="text-right px-4 py-3 text-[#6a5a4a] font-normal text-xs uppercase tracking-wider">Eff. Guarantee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2218]">
                {claims.map((claim) => {
                  const isDeadlineClose = isApproachingDeadline(claim)
                  const stage = claim.stage as string
                  const isOpen = OPEN_STAGES.includes(stage)

                  return (
                    <tr
                      key={claim.id as string}
                      className="bg-[#080604] hover:bg-[#0e0c0b] transition-colors"
                    >
                      <td className="px-4 py-3 text-[#e8d8c0]">
                        {(claim.crop as string | null) ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={[
                            'inline-block px-2 py-0.5 rounded text-xs',
                            isOpen
                              ? 'bg-[#7A9E7E]/10 text-[#7A9E7E] border border-[#7A9E7E]/20'
                              : 'bg-[#2a2218] text-[#6a5a4a] border border-[#2a2218]',
                          ].join(' ')}
                        >
                          {STAGE_LABELS[stage] ?? stage}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#e8d8c0]">
                        {claim.coverage_type as string | null ?? '—'}
                        {typeof claim.coverage_level === 'number'
                          ? ` ${claim.coverage_level}%`
                          : ''}
                      </td>
                      <td className="px-4 py-3 text-[#e8d8c0]">
                        {formatDate(claim.date_of_loss as string | null)}
                      </td>
                      <td className={`px-4 py-3 ${isDeadlineClose ? 'text-[#C8860A]' : 'text-[#e8d8c0]'}`}>
                        {formatDate(claim.deadline_at as string | null)}
                        {isDeadlineClose && (
                          <span className="ml-2 text-xs text-[#C8860A]">Soon</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-[#e8d8c0]">
                        {formatDollars(claim.effective_guarantee as number | null)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
