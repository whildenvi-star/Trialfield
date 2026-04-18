import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { fetchCertService } from '@/app/api/mobile/_lib/proxy'

/**
 * DELETE /api/field-ops/tcs/[id]
 *
 * Deletes a TC record from organic-cert.
 *
 * URL params:
 *   id — the organic-cert FieldOperation ID
 *
 * Query params:
 *   fieldEnterpriseId  — required to construct the cert URL
 *   tcByCertUserId     — cert user who created the TC (for ownership check)
 *
 * Permissions:
 *   - Admin role → may delete any TC
 *   - Other roles → may only delete TCs they created (caller cert_user_id === tcByCertUserId)
 *
 * Returns: { success: true } on success
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const fieldEnterpriseId = searchParams.get('fieldEnterpriseId')
  const tcByCertUserId = searchParams.get('tcByCertUserId')

  if (!fieldEnterpriseId) {
    return NextResponse.json(
      { error: 'Missing required query param: fieldEnterpriseId' },
      { status: 400 }
    )
  }
  if (!id) {
    return NextResponse.json({ error: 'Missing TC id in URL' }, { status: 400 })
  }

  // Load caller profile (role + cert_user_id) via admin client to bypass RLS
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role, cert_user_id')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  const callerCertUserId = profile?.cert_user_id ?? null

  // Permission check: admin can delete anything; others only own TCs
  if (!isAdmin) {
    if (!callerCertUserId || callerCertUserId !== tcByCertUserId) {
      return NextResponse.json(
        { error: 'You can only delete TCs you created' },
        { status: 403 }
      )
    }
  }

  // DELETE from organic-cert
  let certRes: Response
  try {
    certRes = await fetchCertService(
      `/api/field-enterprises/${fieldEnterpriseId}/operations/${id}`,
      { method: 'DELETE' }
    )
  } catch {
    return NextResponse.json(
      { error: 'organic-cert service unavailable' },
      { status: 502 }
    )
  }

  if (certRes.status === 404) {
    return NextResponse.json({ error: 'TC not found' }, { status: 404 })
  }

  if (!certRes.ok) {
    const errBody = await certRes.text().catch(() => '')
    return NextResponse.json(
      { error: 'Failed to delete TC', status: certRes.status, details: errBody },
      { status: certRes.status }
    )
  }

  return NextResponse.json({ success: true })
}
