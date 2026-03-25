import { NextResponse } from 'next/server'
import { getMobileUser, isErrorResponse } from '../../_lib/auth'
import { fetchCertService } from '../../_lib/proxy'
import { resolveFieldEnterpriseId } from '../../_lib/cert-bridge'

/**
 * POST /api/mobile/passes/confirm
 *
 * Confirm a planned pass for a field. Writes a CONFIRMED FieldOperation to
 * organic-cert with plannedSource "mobile-logger" for NOP audit history.
 *
 * Body:
 *   fieldId             — farm-budget/registry field ID
 *   passId              — machinery entry ID from farm-budget (budgetImplementId)
 *   passType            — operation type (e.g. "Tillage", "Planting")
 *   operationDate?      — ISO date string, defaults to today
 *   operatorCertUserId? — organic-cert User ID override, defaults to caller's certUserId
 *
 * Returns: { success: true, fieldOperationId: string, confirmedAt: string }
 */
export async function POST(request: Request) {
  const user = await getMobileUser(request)
  if (isErrorResponse(user)) return user

  if (!user.certUserId) {
    return NextResponse.json(
      { error: 'User has no organic-cert account linked. Contact admin.' },
      { status: 403 }
    )
  }

  let body: {
    fieldId?: string
    passId?: string
    passType?: string
    operationDate?: string
    operatorCertUserId?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { fieldId, passId, passType, operationDate, operatorCertUserId } = body

  if (!fieldId) {
    return NextResponse.json({ error: 'Missing required field: fieldId' }, { status: 400 })
  }
  if (!passId) {
    return NextResponse.json({ error: 'Missing required field: passId' }, { status: 400 })
  }
  if (!passType) {
    return NextResponse.json({ error: 'Missing required field: passType' }, { status: 400 })
  }

  // Resolve organic-cert fieldEnterpriseId from farm-budget registryId
  let fieldEnterpriseId: string
  try {
    fieldEnterpriseId = await resolveFieldEnterpriseId(fieldId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 404 })
  }

  const effectiveOperatorId = operatorCertUserId ?? user.certUserId
  const effectiveDate = operationDate ?? new Date().toISOString().split('T')[0]
  const confirmedAt = new Date().toISOString()

  // POST to organic-cert field operations
  let certRes: Response
  try {
    certRes = await fetchCertService(`/api/field-enterprises/${fieldEnterpriseId}/operations`, {
      method: 'POST',
      body: JSON.stringify({
        type: passType,
        operationDate: effectiveDate,
        operatorId: effectiveOperatorId,
        passStatus: 'CONFIRMED',
        plannedSource: 'mobile-logger',
        budgetImplementId: passId,
        description: 'Confirmed via mobile logger',
      }),
    })
  } catch {
    return NextResponse.json(
      { error: 'organic-cert service unavailable' },
      { status: 502 }
    )
  }

  if (!certRes.ok) {
    const errBody = await certRes.text().catch(() => '')
    return NextResponse.json(
      { error: 'organic-cert service unavailable', details: errBody },
      { status: 502 }
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const created: any = await certRes.json()

  return NextResponse.json({
    success: true,
    fieldOperationId: created.id,
    confirmedAt,
  })
}
