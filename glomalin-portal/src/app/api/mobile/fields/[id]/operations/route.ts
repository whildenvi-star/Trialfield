import { NextResponse } from 'next/server'
import { getMobileUser, isErrorResponse } from '../../../_lib/auth'
import { fetchCertService } from '../../../_lib/proxy'

const VALID_TYPES = [
  'TILLAGE', 'PLANTING', 'CULTIVATION', 'MOWING',
  'IRRIGATION', 'FLAMING', 'HARVEST', 'SPRAYING', 'OTHER',
]

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getMobileUser(request)
  if (isErrorResponse(user)) return user

  const { id: enterpriseId } = await params
  const body = await request.json()

  // Validate required fields
  if (!body.type || !VALID_TYPES.includes(body.type)) {
    return NextResponse.json(
      { error: `type is required and must be one of: ${VALID_TYPES.join(', ')}` },
      { status: 400 }
    )
  }
  if (!body.operationDate) {
    return NextResponse.json(
      { error: 'operationDate is required' },
      { status: 400 }
    )
  }

  // Don't allow future dates
  const opDate = new Date(body.operationDate)
  if (opDate > new Date()) {
    return NextResponse.json(
      { error: 'operationDate cannot be in the future' },
      { status: 400 }
    )
  }

  try {
    const payload = {
      type: body.type,
      operationDate: body.operationDate,
      equipmentId: body.equipmentId ?? null,
      operatorId: user.certUserId ?? user.id,
      acresWorked: body.acresWorked ?? null,
      description: body.description ?? '',
      notes: body.notes ?? '',
    }

    const res = await fetchCertService(
      `/api/field-enterprises/${enterpriseId}/operations`,
      { method: 'POST', body: JSON.stringify(payload) }
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json(
        { error: err.error ?? `Operation failed: ${res.status}` },
        { status: res.status }
      )
    }

    const data = await res.json()
    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: 'Organic-cert service unavailable' },
      { status: 502 }
    )
  }
}
