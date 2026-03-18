import { NextResponse } from 'next/server'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'

/**
 * Proxy to farm-budget API for programs and dashboard data.
 * Returns { programs, dashboard } for the crop comparison sandbox.
 */
export async function GET() {
  const guard = await requireModuleAccess('macro-rollup')
  if (isGuardError(guard)) return guard

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fetchOptions: any = {
    signal: AbortSignal.timeout(5000),
    next: { revalidate: 0 },
  }

  try {
    const [programsRes, dashboardRes] = await Promise.all([
      fetch('http://localhost:3001/api/programs', fetchOptions),
      fetch('http://localhost:3001/api/dashboard', fetchOptions),
    ])

    if (!programsRes.ok) throw new Error(`Programs: ${programsRes.status}`)
    if (!dashboardRes.ok) throw new Error(`Dashboard: ${dashboardRes.status}`)

    const [programs, dashboard] = await Promise.all([
      programsRes.json(),
      dashboardRes.json(),
    ])

    return NextResponse.json({ programs, dashboard })
  } catch {
    return NextResponse.json(
      { error: 'Farm-budget is offline' },
      { status: 502 }
    )
  }
}
