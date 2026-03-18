import { NextResponse } from 'next/server'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'

// Allowed MIME types for claim document uploads
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
])

// Sanitize a filename: replace spaces with hyphens, strip non-alphanumeric chars (except dots and hyphens)
function sanitizeFilename(filename: string): string {
  return filename.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.\-]/g, '')
}

// POST /api/claims/[id]/upload-url
// Generates a signed upload URL for client-side file upload directly to Supabase Storage.
// File bytes never route through this server action — the client PUTs directly to Storage.
// Three-step upload flow: server generates URL → client PUT to Storage → client POST metadata
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireModuleAccess('claims')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  const { id } = await params

  // Parse request body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { filename, mimeType } = body

  if (typeof filename !== 'string' || !filename) {
    return NextResponse.json({ error: 'filename is required' }, { status: 400 })
  }
  if (typeof mimeType !== 'string' || !mimeType) {
    return NextResponse.json({ error: 'mimeType is required' }, { status: 400 })
  }

  // Validate file type — reject unsupported MIME types
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return NextResponse.json(
      {
        error: 'Unsupported file type',
        allowedTypes: Array.from(ALLOWED_MIME_TYPES),
      },
      { status: 400 }
    )
  }

  // Verify claim exists before generating a storage URL for it
  const { data: claim, error: claimError } = await supabase
    .from('claims')
    .select('id')
    .eq('id', id)
    .single()

  if (claimError || !claim) {
    return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
  }

  // Build storage path: claims/{id}/{timestamp}-{sanitizedFilename}
  const sanitizedFilename = sanitizeFilename(filename)
  const path = `claims/${id}/${Date.now()}-${sanitizedFilename}`

  // Generate signed upload URL — client PUTs file bytes directly to this URL
  // Supabase Storage enforces its own size limit (default 50MB per object).
  const { data, error: signedUrlError } = await supabase.storage
    .from('claim-documents')
    .createSignedUploadUrl(path)

  if (signedUrlError || !data) {
    return NextResponse.json(
      { error: 'Failed to generate signed upload URL', details: signedUrlError?.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    path,
    token: data.token,
    signedUrl: data.signedUrl,
  })
}
