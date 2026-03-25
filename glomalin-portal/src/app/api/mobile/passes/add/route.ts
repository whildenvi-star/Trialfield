import { NextResponse } from 'next/server'
import { getMobileUser, isErrorResponse } from '../../_lib/auth'
import { fetchCertService } from '../../_lib/proxy'
import { resolveFieldEnterpriseId, OP_TYPE_MAP } from '../../_lib/cert-bridge'

/**
 * POST /api/mobile/passes/add
 *
 * Add an unplanned pass for a field. Writes a CONFIRMED FieldOperation to
 * organic-cert with plannedSource "mobile-logger" and dataSource "MANUAL".
 *
 * Body:
 *   fieldId             — farm-budget/registry field ID
 *   operationType       — UI-friendly type: Tillage, Planting, Herbicide, Fertilizer,
 *                         Harvest, Scouting, Other (or raw FieldOpType enum values)
 *   operationDate?      — ISO date string, defaults to today
 *   notes?              — optional description
 *   operatorCertUserId? — organic-cert User ID override, defaults to caller's certUserId
 *
 * Returns: { success: true, fieldOperationId: string, pass: { id, type, status, operationDate, operatorName } }
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
    operationType?: string
    operationDate?: string
    notes?: string
    operatorCertUserId?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { fieldId, operationType, operationDate, notes, operatorCertUserId } = body

  if (!fieldId) {
    return NextResponse.json({ error: 'Missing required field: fieldId' }, { status: 400 })
  }
  if (!operationType) {
    return NextResponse.json({ error: 'Missing required field: operationType' }, { status: 400 })
  }

  // Map UI-friendly type to organic-cert FieldOpType enum
  const certOpType = OP_TYPE_MAP[operationType]
  if (!certOpType) {
    const validTypes = Object.keys(OP_TYPE_MAP).filter((k) => k === k.toUpperCase() || !OP_TYPE_MAP[k.toUpperCase()])
    return NextResponse.json(
      { error: `Invalid operationType "${operationType}". Valid values: ${validTypes.join(', ')}` },
      { status: 400 }
    )
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

  // POST to organic-cert field operations
  let certRes: Response
  try {
    certRes = await fetchCertService(`/api/field-enterprises/${fieldEnterpriseId}/operations`, {
      method: 'POST',
      body: JSON.stringify({
        type: certOpType,
        operationDate: effectiveDate,
        operatorId: effectiveOperatorId,
        passStatus: 'CONFIRMED',
        plannedSource: 'mobile-logger',
        dataSource: 'MANUAL',
        description: notes ?? null,
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
    pass: {
      id: created.id,
      type: operationType,
      status: 'CONFIRMED',
      operationDate: effectiveDate,
      operatorName: null, // caller can enrich from operators endpoint if needed
    },
  })
}
