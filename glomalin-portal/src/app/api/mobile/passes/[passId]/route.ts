import { NextResponse } from 'next/server'
import { getMobileUser, isErrorResponse } from '../../_lib/auth'
import { fetchCertService } from '../../_lib/proxy'

/**
 * PUT /api/mobile/passes/[passId]
 *
 * Edit a confirmed pass — update operationDate and/or operator.
 * Used after the undo window has closed and the user wants to backdate or reassign.
 *
 * Body:
 *   fieldEnterpriseId   — organic-cert fieldEnterprise ID (returned by crop-plans detail)
 *   operationDate?      — new ISO date string
 *   operatorCertUserId? — new organic-cert User ID for operator
 *
 * Returns: { success: true }
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ passId: string }> }
) {
  const user = await getMobileUser(request)
  if (isErrorResponse(user)) return user

  if (!user.certUserId) {
    return NextResponse.json(
      { error: 'User has no organic-cert account linked. Contact admin.' },
      { status: 403 }
    )
  }

  const { passId } = await params

  let body: {
    fieldEnterpriseId?: string
    operationDate?: string
    operatorCertUserId?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { fieldEnterpriseId, operationDate, operatorCertUserId } = body

  if (!fieldEnterpriseId) {
    return NextResponse.json(
      { error: 'Missing required field: fieldEnterpriseId' },
      { status: 400 }
    )
  }

  // Build update payload — only send fields that were provided
  const updatePayload: Record<string, unknown> = { id: passId }
  if (operationDate !== undefined) updatePayload.operationDate = operationDate
  if (operatorCertUserId !== undefined) updatePayload.operatorId = operatorCertUserId

  // Proxy PUT to organic-cert field operations
  let certRes: Response
  try {
    certRes = await fetchCertService(`/api/field-enterprises/${fieldEnterpriseId}/operations`, {
      method: 'PUT',
      body: JSON.stringify(updatePayload),
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

  return NextResponse.json({ success: true })
}
