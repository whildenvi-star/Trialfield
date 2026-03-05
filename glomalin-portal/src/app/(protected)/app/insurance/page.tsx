import { createClient } from '@/lib/supabase/server'

interface InsurancePolicy {
  id: string
  legacy_id: string
  farm_name: string | null
  farm_number: string | null
  line_number: string | null
  policy_number: string | null
  crop: string | null
  policy_year: number
  planted_acres: number
  fsa_acres_manual: number | null
  guarantee: number
  actual: number
  coverage_level: number
  unit_type: string | null
  premium_per_acre: number | null
  agent_name: string | null
  prevented_planting: boolean
  prevented_planting_acres: number | null
  notes: string | null
  // Phase 29 columns
  aph_computed: number | null
  aph_clu_count: number | null
  actual_synced_from_grain: boolean
  claim_alert: string
}

export default async function InsurancePage() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('insurance_policies')
    .select('*')
    .eq('policy_year', 2026)
    .order('farm_name')

  const policies: InsurancePolicy[] = (data as InsurancePolicy[]) ?? []

  // Stat card calculations
  const totalPolicies = policies.length
  const cropsInsured = new Set(
    policies.filter((p) => p.crop && p.crop.trim()).map((p) => p.crop!.trim().toLowerCase())
  ).size
  const claimAlerts = policies.filter((p) => p.claim_alert === 'potential').length

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-mono font-semibold text-soil-accent">Crop Insurance</h1>
        <p className="text-soil-muted text-sm mt-1">2026 policy year — decision support tool</p>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 rounded-md border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-300">
          Failed to load insurance policies: {error.message}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-lg border border-soil-border bg-soil-surface px-5 py-4">
          <p className="text-xs text-soil-muted uppercase tracking-wide font-mono mb-1">Policies</p>
          <p className="text-3xl font-mono font-bold text-soil-text">{totalPolicies}</p>
        </div>
        <div className="rounded-lg border border-soil-border bg-soil-surface px-5 py-4">
          <p className="text-xs text-soil-muted uppercase tracking-wide font-mono mb-1">Crops Insured</p>
          <p className="text-3xl font-mono font-bold text-soil-text">{cropsInsured}</p>
        </div>
        <div className="rounded-lg border border-soil-border bg-soil-surface px-5 py-4">
          <p className="text-xs text-soil-muted uppercase tracking-wide font-mono mb-1">Claim Alerts</p>
          <p className={`text-3xl font-mono font-bold ${claimAlerts > 0 ? 'text-yellow-400' : 'text-soil-text'}`}>
            {claimAlerts}
          </p>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-soil-muted mb-6 italic">
        This is a decision-support tool, not an official insurance summary. Verify all figures
        with your insurance agent before making coverage decisions.
      </p>

      {/* Policy table */}
      {policies.length === 0 ? (
        <div className="rounded-lg border border-soil-border bg-soil-surface px-6 py-12 text-center">
          <p className="text-soil-muted text-sm">
            No insurance policies found for 2026.{' '}
            Run <code className="text-soil-accent">npx tsx scripts/migrate-fsa.ts</code> to
            populate data.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-soil-border overflow-hidden">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="bg-soil-surface border-b border-soil-border">
                <th className="px-4 py-3 text-left text-soil-accent font-semibold">Farm</th>
                <th className="px-4 py-3 text-left text-soil-accent font-semibold">Crop</th>
                <th className="px-4 py-3 text-right text-soil-accent font-semibold">Coverage</th>
                <th className="px-4 py-3 text-right text-soil-accent font-semibold">Guarantee (bu/ac)</th>
                <th className="px-4 py-3 text-right text-soil-accent font-semibold">Actual (bu/ac)</th>
                <th className="px-4 py-3 text-center text-soil-accent font-semibold">Alert</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((policy, idx) => {
                const hasVerifyNote = policy.notes && policy.notes.includes('VERIFY')
                const isAlternateRow = idx % 2 === 1

                return (
                  <tr
                    key={policy.id}
                    className={`border-b border-soil-border last:border-0 ${
                      isAlternateRow ? 'bg-soil-bg' : 'bg-soil-surface'
                    }`}
                  >
                    {/* Farm name — warn in orange if notes contains VERIFY */}
                    <td className="px-4 py-3">
                      <span className={hasVerifyNote ? 'text-orange-400' : 'text-soil-text'}>
                        {policy.farm_name ?? '(no farm)'}
                      </span>
                      {hasVerifyNote && (
                        <span className="ml-2 text-xs text-orange-400 bg-orange-900/30 rounded px-1 py-0.5">
                          VERIFY
                        </span>
                      )}
                    </td>

                    {/* Crop */}
                    <td className="px-4 py-3 text-soil-text">
                      {policy.crop ?? <span className="text-soil-muted">(none)</span>}
                    </td>

                    {/* Coverage level as percentage */}
                    <td className="px-4 py-3 text-right text-soil-text">
                      {policy.coverage_level}%
                    </td>

                    {/* Guarantee bu/ac */}
                    <td className="px-4 py-3 text-right text-soil-text">
                      {policy.guarantee > 0 ? policy.guarantee.toFixed(1) : (
                        <span className="text-soil-muted">—</span>
                      )}
                    </td>

                    {/* Actual bu/ac */}
                    <td className="px-4 py-3 text-right text-soil-text">
                      {policy.actual > 0 ? (
                        <span>
                          {policy.actual.toFixed(1)}
                          {policy.actual_synced_from_grain && (
                            <span className="ml-1 text-xs text-soil-muted" title="Synced from grain tickets">
                              (GT)
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-soil-muted">—</span>
                      )}
                    </td>

                    {/* Claim alert badge */}
                    <td className="px-4 py-3 text-center">
                      {policy.claim_alert === 'potential' ? (
                        <span className="inline-flex items-center rounded-full bg-yellow-900/40 border border-yellow-700 px-2 py-0.5 text-xs text-yellow-300 font-medium">
                          Potential
                        </span>
                      ) : (
                        <span className="text-soil-muted text-xs">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Notes section for any flagged policies */}
      {policies.some((p) => p.notes && p.notes.includes('VERIFY')) && (
        <div className="mt-4 rounded-md border border-orange-800/50 bg-orange-950/30 px-4 py-3 text-sm">
          <p className="text-orange-400 font-semibold mb-1">Data Review Required</p>
          {policies
            .filter((p) => p.notes && p.notes.includes('VERIFY'))
            .map((p) => (
              <p key={p.id} className="text-orange-300 text-xs">
                {p.farm_name ?? '(no farm)'} / {p.crop ?? 'no crop'}: {p.notes}
              </p>
            ))}
        </div>
      )}
    </div>
  )
}
