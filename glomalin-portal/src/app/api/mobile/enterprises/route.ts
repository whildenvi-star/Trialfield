import { NextResponse } from 'next/server'
import { getMobileUser, isErrorResponse } from '../_lib/auth'
import { fetchBudgetService } from '../_lib/proxy'

/** Financial fields to strip from dashboard crop rows */
const STRIP_CROP_FIELDS = [
  'profitPerAcre', 'cop', 'avgMachinery',
]

/** Financial fields to strip from dashboard totals */
const STRIP_TOTAL_FIELDS = [
  'rent', 'springFert', 'fallFert', 'fert', 'seed', 'machinery',
  'laborOverhead', 'fuel', 'drying', 'interest', 'insurance',
  'expTotal', 'cropIncome', 'insIncome', 'govPayments',
  'coreIncome', 'incomeWithPayments', 'cropProfit',
  'profitWithoutPayments', 'profitWithPayments',
  'avgProfitPerAcre', 'avgExpPerAcre', 'cop',
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripFields(obj: any, fields: string[]): any {
  if (!obj || typeof obj !== 'object') return obj
  const result = { ...obj }
  for (const field of fields) delete result[field]
  return result
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cleanEnterprise(entry: any) {
  return {
    enterprise: entry.enterprise,
    cropRows: (entry.cropRows ?? []).map((row: Record<string, unknown>) =>
      stripFields(row, STRIP_CROP_FIELDS)
    ),
    totals: stripFields(entry.totals, STRIP_TOTAL_FIELDS),
  }
}

export async function GET(request: Request) {
  const user = await getMobileUser(request)
  if (isErrorResponse(user)) return user

  try {
    const url = new URL(request.url)
    const yieldMode = url.searchParams.get('yieldMode') ?? 'projected'
    const res = await fetchBudgetService(`/api/dashboard?yieldMode=${yieldMode}`)
    if (!res.ok) throw new Error(`Dashboard: ${res.status}`)

    const dashboard = await res.json()

    return NextResponse.json({
      yieldMode: dashboard.yieldMode,
      conventional: (dashboard.conventional ?? []).map(cleanEnterprise),
      organic: (dashboard.organic ?? []).map(cleanEnterprise),
    })
  } catch {
    return NextResponse.json(
      { error: 'Farm-budget service unavailable' },
      { status: 502 }
    )
  }
}
