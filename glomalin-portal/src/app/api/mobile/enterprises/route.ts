import { NextResponse } from 'next/server'
import { getMobileUser, isErrorResponse } from '../_lib/auth'
import { fetchBudgetService } from '../_lib/proxy'

/** Financial fields to strip from crop rows for non-owner roles */
const STRIP_CROP_FIELDS_BASE = ['profitPerAcre', 'cop', 'avgMachinery']
/** Financial fields to strip from crop rows for owner role (keep profitPerAcre + cop) */
const STRIP_CROP_FIELDS_OWNER = ['avgMachinery']

/** Financial fields to strip from totals for non-owner roles */
const STRIP_TOTAL_FIELDS_BASE = [
  'rent', 'springFert', 'fallFert', 'fert', 'seed', 'machinery',
  'laborOverhead', 'fuel', 'drying', 'interest', 'insurance',
  'expTotal', 'cropIncome', 'insIncome', 'govPayments',
  'coreIncome', 'incomeWithPayments', 'cropProfit',
  'profitWithoutPayments', 'profitWithPayments',
  'avgProfitPerAcre', 'avgExpPerAcre', 'cop',
]
/** Financial fields to strip from totals for owner role (keep profit summary fields) */
const STRIP_TOTAL_FIELDS_OWNER = [
  'rent', 'springFert', 'fallFert', 'fert', 'seed', 'machinery',
  'laborOverhead', 'fuel', 'drying', 'interest', 'insurance',
  'expTotal', 'cropIncome', 'insIncome', 'govPayments',
  'coreIncome', 'incomeWithPayments', 'profitWithoutPayments',
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripFields(obj: any, fields: string[]): any {
  if (!obj || typeof obj !== 'object') return obj
  const result = { ...obj }
  for (const field of fields) delete result[field]
  return result
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cleanEnterprise(entry: any, isOwner: boolean) {
  const cropStripFields = isOwner ? STRIP_CROP_FIELDS_OWNER : STRIP_CROP_FIELDS_BASE
  const totalStripFields = isOwner ? STRIP_TOTAL_FIELDS_OWNER : STRIP_TOTAL_FIELDS_BASE
  return {
    enterprise: entry.enterprise,
    cropRows: (entry.cropRows ?? []).map((row: Record<string, unknown>) =>
      stripFields(row, cropStripFields)
    ),
    totals: stripFields(entry.totals, totalStripFields),
  }
}

export async function GET(request: Request) {
  const user = await getMobileUser(request)
  if (isErrorResponse(user)) return user

  const isOwner = user.role === 'owner' || user.role === 'admin'

  try {
    const url = new URL(request.url)
    const yieldMode = url.searchParams.get('yieldMode') ?? 'projected'
    const res = await fetchBudgetService(`/api/dashboard?yieldMode=${yieldMode}`)
    if (!res.ok) throw new Error(`Dashboard: ${res.status}`)

    const dashboard = await res.json()

    return NextResponse.json({
      yieldMode: dashboard.yieldMode,
      conventional: (dashboard.conventional ?? []).map((e: unknown) => cleanEnterprise(e, isOwner)),
      organic: (dashboard.organic ?? []).map((e: unknown) => cleanEnterprise(e, isOwner)),
    })
  } catch {
    return NextResponse.json(
      { error: 'Farm-budget service unavailable' },
      { status: 502 }
    )
  }
}
