import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MODULES } from '@/lib/modules'

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

  return (
    <div>
      <h1 className="text-2xl font-bold font-mono text-soil-text tracking-wide">
        Dashboard
      </h1>
      <p className="mt-2 mb-6 text-soil-muted font-mono text-sm">
        Farm Modules
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODULES.map((mod) => {
          const hasAccess = grantedModules.has(mod.id)

          if (hasAccess) {
            return (
              <Link key={mod.id} href={mod.route}>
                <div className="bg-soil-surface border border-soil-border rounded-lg p-6 hover:border-soil-accent transition-colors cursor-pointer group relative">
                  {/* Arrow icon at top-right */}
                  <div className="absolute top-4 right-4">
                    <svg
                      className="w-4 h-4 text-soil-muted group-hover:text-soil-accent transition-colors"
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

                  <p className="text-lg font-bold font-mono text-soil-text group-hover:text-soil-accent transition-colors pr-6">
                    {mod.label}
                  </p>
                  <p className="text-sm text-soil-muted font-mono mt-1">
                    {mod.sublabel}
                  </p>
                  <p className="text-xs font-mono text-soil-green mt-3 uppercase tracking-wider">
                    Coming Soon
                  </p>
                </div>
              </Link>
            )
          }

          return (
            <div
              key={mod.id}
              className="bg-soil-surface border border-soil-border rounded-lg p-6 opacity-40 cursor-not-allowed relative"
            >
              {/* Lock icon at top-right */}
              <div className="absolute top-4 right-4">
                <svg
                  className="w-4 h-4 text-soil-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              </div>

              <p className="text-lg font-bold font-mono text-soil-text pr-6">
                {mod.label}
              </p>
              <p className="text-sm text-soil-muted font-mono mt-1">
                {mod.sublabel}
              </p>
              <p className="text-xs font-mono text-soil-muted mt-3 uppercase tracking-wider">
                No Access
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
