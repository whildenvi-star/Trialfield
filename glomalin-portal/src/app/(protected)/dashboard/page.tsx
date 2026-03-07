import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MODULES } from '@/lib/modules'
import { SummaryCards } from '@/components/dashboard/summary-cards'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Defensive check — middleware should catch this, but be safe
  if (!user) {
    redirect('/login')
  }

  // Fetch all module_access rows for this user
  const { data: accessRows } = await supabase
    .from('module_access')
    .select('module, granted')
    .eq('user_id', user.id)

  // Build a Set of granted module IDs for O(1) lookup
  const grantedModules = new Set<string>(
    (accessRows ?? [])
      .filter((row) => row.granted === true)
      .map((row) => row.module)
  )

  // Fetch summary data for the three FSA/Insurance/Claims modules in parallel.
  // Use Promise.allSettled so a single table query failure does not crash the dashboard.
  const results = await Promise.allSettled([
    supabase.from('clu_records').select('id, reported').eq('crop_year', 2026),
    supabase.from('insurance_policies').select('id').eq('policy_year', 2026).eq('claim_alert', 'potential'),
    supabase.from('claims').select('id').neq('stage', 'closed'),
  ])

  // FSA summary: count total rows and filter for reported=true
  const fsaResult = results[0]
  const fsaSummary =
    fsaResult.status === 'fulfilled' && !fsaResult.value.error && fsaResult.value.data !== null
      ? {
          reported: fsaResult.value.data.filter((row) => row.reported === true).length,
          total: fsaResult.value.data.length,
        }
      : null

  // Insurance summary: count rows with claim_alert='potential'
  const insuranceResult = results[1]
  const insuranceSummary =
    insuranceResult.status === 'fulfilled' && !insuranceResult.value.error && insuranceResult.value.data !== null
      ? { claimAlerts: insuranceResult.value.data.length }
      : null

  // Claims summary: count open claims (stage != 'closed')
  const claimsResult = results[2]
  const claimsSummary =
    claimsResult.status === 'fulfilled' && !claimsResult.value.error && claimsResult.value.data !== null
      ? { openCount: claimsResult.value.data.length }
      : null

  return (
    <div>
      <h1 className="text-2xl font-bold font-mono text-glomalin-text tracking-wide">
        Dashboard
      </h1>
      <p className="mt-2 mb-6 text-glomalin-muted font-mono text-sm">
        Farm Modules
      </p>

      {/* Summary cards: FSA reporting progress, Insurance alerts, Claims pipeline */}
      <SummaryCards
        fsa={fsaSummary}
        insurance={insuranceSummary}
        claims={claimsSummary}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODULES.filter((mod) => grantedModules.has(mod.id)).map((mod) => (
          <Link key={mod.id} href={mod.route}>
            <div className="bg-glomalin-surface border border-glomalin-border rounded-lg p-6 hover:border-glomalin-accent transition-colors cursor-pointer group relative">
              {/* Arrow icon at top-right */}
              <div className="absolute top-4 right-4">
                <svg
                  className="w-4 h-4 text-glomalin-muted group-hover:text-glomalin-accent transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>

              <p className="text-lg font-bold font-mono text-glomalin-text group-hover:text-glomalin-accent transition-colors pr-6">
                {mod.label}
              </p>
              <p className="text-sm text-glomalin-muted font-mono mt-1">
                {mod.sublabel}
              </p>
              <p className={`text-xs font-mono mt-3 uppercase tracking-wider ${mod.status === 'live' ? 'text-glomalin-green' : 'text-glomalin-muted'}`}>
                {mod.status === 'live' ? 'Active' : 'Coming Soon'}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
