import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Valid document categories
const VALID_CATEGORIES = new Set([
  'notice_of_loss',
  'adjuster_report',
  'photos',
  'settlement',
  'other',
])

const DEFAULT_CATEGORY = 'other'

// Signed download URL expiry: 1 hour (3600 seconds)
const SIGNED_URL_EXPIRY_SECONDS = 3600

// GET /api/claims/[id]/documents
// Lists all documents for a claim with signed download URLs (1-hour expiry).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Fetch documents for this claim, newest first
  const { data: documents, error } = await supabase
    .from('claim_documents')
    .select('*')
    .eq('claim_id', id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch documents', details: error.message },
      { status: 500 }
    )
  }

  const docs = documents ?? []

  // Generate signed download URLs for each document so Phase 32 UI can render links
  const documentsWithUrls = await Promise.all(
    docs.map(async (doc) => {
      const { data: signedData } = await supabase.storage
        .from('claim-documents')
        .createSignedUrl(doc.storage_path, SIGNED_URL_EXPIRY_SECONDS)

      return {
        ...doc,
        signedUrl: signedData?.signedUrl ?? null,
      }
    })
  )

  return NextResponse.json({
    documents: documentsWithUrls,
    count: documentsWithUrls.length,
  })
}

// POST /api/claims/[id]/documents
// Saves document metadata after client has completed uploading to Storage via signed URL.
// Three-step upload flow: server generates URL → client PUT to Storage → client POST here
// Body: { storagePath: string, filename: string, fileSize: number, mimeType: string, category?: string }
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Parse request body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { storagePath, filename, fileSize, mimeType, category } = body

  if (typeof storagePath !== 'string' || !storagePath) {
    return NextResponse.json({ error: 'storagePath is required' }, { status: 400 })
  }
  if (typeof filename !== 'string' || !filename) {
    return NextResponse.json({ error: 'filename is required' }, { status: 400 })
  }
  if (typeof fileSize !== 'number' || fileSize < 0) {
    return NextResponse.json({ error: 'fileSize must be a non-negative number' }, { status: 400 })
  }
  if (typeof mimeType !== 'string' || !mimeType) {
    return NextResponse.json({ error: 'mimeType is required' }, { status: 400 })
  }

  // Validate category if provided; default to 'other' if omitted
  let resolvedCategory = DEFAULT_CATEGORY
  if (category !== undefined) {
    if (typeof category !== 'string' || !VALID_CATEGORIES.has(category)) {
      return NextResponse.json(
        {
          error: 'Invalid category',
          validCategories: Array.from(VALID_CATEGORIES),
        },
        { status: 400 }
      )
    }
    resolvedCategory = category
  }

  // Insert claim_documents metadata row
  const { data: document, error: insertError } = await supabase
    .from('claim_documents')
    .insert({
      claim_id: id,
      storage_path: storagePath,
      filename,
      file_size: fileSize,
      mime_type: mimeType,
      category: resolvedCategory,
      uploaded_by: user.id,
    })
    .select()
    .single()

  if (insertError || !document) {
    return NextResponse.json(
      { error: 'Failed to save document metadata', details: insertError?.message },
      { status: 500 }
    )
  }

  // Write doc_upload event to claim_timeline for audit trail
  const { error: timelineError } = await supabase.from('claim_timeline').insert({
    claim_id: id,
    event_type: 'doc_upload',
    event_data: {
      filename,
      category: resolvedCategory,
      storage_path: storagePath,
    },
    actor_id: user.id,
  })

  if (timelineError) {
    // Non-fatal — document metadata saved successfully; log and continue
    console.error('Warning: Failed to write doc_upload event to claim_timeline:', timelineError.message)
  }

  return NextResponse.json({ document }, { status: 201 })
}
