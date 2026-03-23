import { NextResponse } from 'next/server'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'
import { fetchBudgetService } from '@/app/api/mobile/_lib/proxy'

/**
 * Proxy to farm-budget API for programs and dashboard data.
 * Returns { programs, dashboard } for the crop comparison sandbox.
 * Uses fetchBudgetService to include embed_session auth cookie.
 */
export async function GET() {
  const guard = await requireModuleAccess('macro-rollup')
  if (isGuardError(guard)) return guard

  try {
    const [programsRes, dashboardRes] = await Promise.all([
      fetchBudgetService('/api/programs'),
      fetchBudgetService('/api/dashboard'),
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
