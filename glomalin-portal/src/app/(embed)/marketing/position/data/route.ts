// JSON twin of the marketing position widget.
//
// MACRO's field editor and Sheet fetch this (same-origin under the Caddy
// /embed/ proxy, so the portal session cookie flows) to show each field's
// marketing context next to its budget price: WAP of current sales, % sold,
// pooled price for the variant, F-IT. Same auth as the widget page; office
// callers get rows with financial keys stripped by loadEnterpriseData.
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getMarketingAuthContext } from '@/lib/supabase/marketing-guard-rsc'
import { loadEnterpriseData } from '@/lib/marketing/load-enterprise-data'
import { CURRENT_CROP_YEAR } from '@/lib/config'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await getMarketingAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const yearParam = Number(req.nextUrl.searchParams.get('year'))
  const cropYear = Number.isFinite(yearParam) && yearParam > 2000 ? yearParam : CURRENT_CROP_YEAR

  const data = await loadEnterpriseData(auth.accessToken, auth.role, cropYear)
  return NextResponse.json(
    {
      cropYear: data.cropYear,
      isOwner: data.isOwner,
      cbotContracts: data.cbotContracts,
      notes: data.notes,
      rows: data.rows,
    },
    { headers: { 'Cache-Control': 'private, no-store' } }
  )
}
