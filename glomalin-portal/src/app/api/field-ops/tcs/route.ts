import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { resolveFieldEnterpriseId, OP_TYPE_MAP } from '@/app/api/mobile/_lib/cert-bridge'
import { fetchCertService } from '@/app/api/mobile/_lib/proxy'

/**
 * Extend the base OP_TYPE_MAP with TC-specific types.
 * We do NOT modify cert-bridge.ts — we spread here and add locally.
 */
const FULL_OP_TYPE_MAP: Record<string, string> = {
  ...OP_TYPE_MAP,
  'No-Till': 'TILLAGE',
  Hauling: 'OTHER',
}

/** Valid UI-facing operation types for TC records. */
const VALID_OP_TYPES = [
  'Tillage',
  'No-Till',
  'Planting',
  'Herbicide',
  'Fertilizer',
  'Scouting',
  'Harvest',
  'Hauling',
  'Other',
]

interface TcRecord {
  id: string
  operationType: string
  operationDate: string
  notes: string | null
  tcByName: string | null
  tcByCertUserId: string | null
  createdAt: string | null
}

interface CertFieldOperation {
  id: string
  type: string
  status: string
  operationDate: string
  plannedSource: string | null
  notes: string | null
  createdAt: string | null
  operator?: {
    id: string
    name: string
  } | null
}

interface CertFieldEnterprise {
  id: string
  fieldOperations?: CertFieldOperation[]
}

/**
 * GET /api/field-ops/tcs
 *
 * Returns all TC records for a given field and year.
 *
 * Query params:
 *   fieldId  — farm-registry field ID (required)
 *   year     — crop year (optional, defaults to current year)
 *
 * Returns: { tcs: TcRecord[], year: number, fieldId: string }
 *          or { tcs: [], noEnterprise: true, year, fieldId } if field has no organic-cert enterprise
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const fieldId = searchParams.get('fieldId')
  const yearParam = searchParams.get('year')
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear()

  if (!fieldId) {
    return NextResponse.json({ error: 'Missing required query param: fieldId' }, { status: 400 })
  }

  // Resolve the organic-cert fieldEnterpriseId for this field/year
  let certFieldEnterpriseId: string
  try {
    certFieldEnterpriseId = await resolveFieldEnterpriseId(fieldId)
  } catch {
    // Field may be conventional (no organic-cert enterprise) — not an error
    return NextResponse.json({ tcs: [], noEnterprise: true, year, fieldId })
  }

  // Fetch FieldEnterprise detail with fieldOperations included
  let enterpriseRes: Response
  try {
    enterpriseRes = await fetchCertService(
      `/api/field-enterprises/${certFieldEnterpriseId}`
    )
  } catch {
    return NextResponse.json(
      { error: 'organic-cert service unavailable' },
      { status: 502 }
    )
  }

  if (!enterpriseRes.ok) {
    return NextResponse.json(
      { error: 'Failed to fetch field enterprise from organic-cert', status: enterpriseRes.status },
      { status: enterpriseRes.status }
    )
  }

  const enterprise: CertFieldEnterprise = await enterpriseRes.json()
  const allOps: CertFieldOperation[] = enterprise.fieldOperations ?? []

  // Filter to TC records for the requested year
  const tcs: TcRecord[] = allOps
    .filter((op) => {
      if (op.plannedSource !== 'field-ops-tc') return false
      const opYear = new Date(op.operationDate).getFullYear()
      return opYear === year
    })
    .map((op) => ({
      id: op.id,
      operationType: op.type,
      operationDate: op.operationDate,
      notes: op.notes ?? null,
      tcByName: op.operator?.name ?? null,
      tcByCertUserId: op.operator?.id ?? null,
      createdAt: op.createdAt ?? null,
    }))

  return NextResponse.json({ tcs, year, fieldId })
}

/**
 * POST /api/field-ops/tcs
 *
 * Creates a TC (Transaction Complete) record for a field operation.
 * Writes to organic-cert FieldOperation with plannedSource="field-ops-tc".
 *
 * Body:
 *   fieldId                  — farm-registry field ID (required)
 *   operationType            — one of VALID_OP_TYPES (required)
 *   operationDate            — ISO date string (required)
 *   notes?                   — optional description
 *   tcByOverrideCertUserId?  — sign off as another user (cert user ID)
 *
 * Returns: cert response as-is on success
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
  let body: {
    fieldId?: string
    operationType?: string
    operationDate?: string
    notes?: string
    tcByOverrideCertUserId?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { fieldId, operationType, operationDate, notes, tcByOverrideCertUserId } = body

  if (!fieldId) {
    return NextResponse.json({ error: 'Missing required field: fieldId' }, { status: 400 })
  }
  if (!operationType) {
    return NextResponse.json({ error: 'Missing required field: operationType' }, { status: 400 })
  }
  if (!operationDate) {
    return NextResponse.json({ error: 'Missing required field: operationDate' }, { status: 400 })
  }

  // Validate operationType
  if (!VALID_OP_TYPES.includes(operationType)) {
    return NextResponse.json(
      {
        error: `Invalid operationType "${operationType}". Valid values: ${VALID_OP_TYPES.join(', ')}`,
      },
      { status: 400 }
    )
  }

  // Map to organic-cert FieldOpType enum
  const certOpType = FULL_OP_TYPE_MAP[operationType]
  if (!certOpType) {
    return NextResponse.json(
      { error: `Unmapped operationType "${operationType}"` },
      { status: 400 }
    )
  }

  // Get caller's cert_user_id from Supabase profile
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('cert_user_id')
    .eq('id', user.id)
    .single()

  if (!profile?.cert_user_id) {
    return NextResponse.json(
      { error: 'User has no organic-cert account linked. Contact admin.' },
      { status: 403 }
    )
  }

  // Resolve organic-cert fieldEnterpriseId
  let certFieldEnterpriseId: string
  try {
    certFieldEnterpriseId = await resolveFieldEnterpriseId(fieldId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: 'No organic-cert enterprise for this field/year', details: msg },
      { status: 422 }
    )
  }

  const effectiveOperatorId = tcByOverrideCertUserId ?? profile.cert_user_id

  // POST to organic-cert field operations
  let certRes: Response
  try {
    certRes = await fetchCertService(
      `/api/field-enterprises/${certFieldEnterpriseId}/operations`,
      {
        method: 'POST',
        body: JSON.stringify({
          type: certOpType,
          status: 'CONFIRMED',
          operationDate,
          notes: notes ?? '',
          plannedSource: 'field-ops-tc',
          dataSource: 'MANUAL',
          operatorId: effectiveOperatorId,
        }),
      }
    )
  } catch {
    return NextResponse.json(
      { error: 'organic-cert service unavailable' },
      { status: 502 }
    )
  }

  if (!certRes.ok) {
    const errBody = await certRes.text().catch(() => '')
    return NextResponse.json(
      { error: 'Failed to create TC', status: certRes.status, details: errBody },
      { status: certRes.status }
    )
  }

  const created: unknown = await certRes.json()
  return NextResponse.json(created)
}
