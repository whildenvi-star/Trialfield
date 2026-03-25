import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CURRENT_CROP_YEAR } from '@/lib/config'

/**
 * GET /api/dashboard/summary
 *
 * Returns the three dashboard summary counts (FSA, insurance, claims) as JSON.
 * This endpoint is designed to be cached by the portal service worker so the
 * dashboard renders from cache when offline.
 *
 * Response shape:
 *   { fsa, insurance, claims, cachedAt }
 *   fsa:        { reported: number, total: number } | null
 *   insurance:  { claimAlerts: number } | null
 *   claims:     { openCount: number } | null
 *   cachedAt:   ISO timestamp set server-side (client may override with SW timestamp)
 */
export async function GET() {
  const supabase = await createClient()

  // Auth guard — only authenticated users may fetch dashboard summaries
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch all three summary counts in parallel; individual failures do not crash
  const results = await Promise.allSettled([
    supabase
      .from('clu_records')
      .select('id, reported')
      .eq('crop_year', CURRENT_CROP_YEAR),
    supabase
      .from('insurance_policies')
      .select('id')
      .eq('policy_year', CURRENT_CROP_YEAR)
      .eq('claim_alert', 'potential'),
    supabase
      .from('claims')
      .select('id')
      .neq('stage', 'closed'),
  ])

  // FSA summary
  const fsaResult = results[0]
  const fsa =
    fsaResult.status === 'fulfilled' &&
    !fsaResult.value.error &&
    fsaResult.value.data !== null
      ? {
          reported: fsaResult.value.data.filter((row) => row.reported === true).length,
          total: fsaResult.value.data.length,
        }
      : null

  // Insurance summary
  const insuranceResult = results[1]
  const insurance =
    insuranceResult.status === 'fulfilled' &&
    !insuranceResult.value.error &&
    insuranceResult.value.data !== null
      ? { claimAlerts: insuranceResult.value.data.length }
      : null

  // Claims summary
  const claimsResult = results[2]
  const claims =
    claimsResult.status === 'fulfilled' &&
    !claimsResult.value.error &&
    claimsResult.value.data !== null
      ? { openCount: claimsResult.value.data.length }
      : null

  return NextResponse.json(
    { fsa, insurance, claims, cachedAt: Date.now() },
    {
      headers: {
        // Allow service worker to cache this response
        'Cache-Control': 'no-cache',
      },
    }
  )
}
