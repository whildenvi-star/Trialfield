import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { CURRENT_CROP_YEAR } from '@/lib/config'

/**
 * POST /api/fsa/webhook/field-created
 *
 * Machine-to-machine webhook called by farm-registry when a new field is created.
 * Creates a minimal CLU record with registry_field_id pre-wired so the FSA module
 * already has a placeholder row the user can fill in with real FSA numbers.
 *
 * Auth: EMBED_TOKEN query param (skipped in dev if EMBED_TOKEN not set).
 * Uses service role key to bypass RLS — this is a trusted server-to-server call.
 */
export async function POST(request: Request) {
  // Auth: check EMBED_TOKEN if configured
  const embedToken = process.env.EMBED_TOKEN
  if (embedToken) {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    if (token !== embedToken) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Parse body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { field_name, fsa_acres, registry_field_id } = body as {
    field_name?: string
    fsa_acres?: number
    registry_field_id?: string
  }

  // Validate required fields
  if (!field_name || !registry_field_id) {
    return NextResponse.json(
      { error: 'field_name and registry_field_id are required' },
      { status: 400 }
    )
  }

  // Service role client — bypasses RLS for webhook writes
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Duplicate check: return existing record if registry_field_id already present for this crop year
  const { data: existing } = await supabase
    .from('clu_records')
    .select('*')
    .eq('registry_field_id', registry_field_id)
    .eq('crop_year', CURRENT_CROP_YEAR)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ status: 200, record: existing })
  }

  // Create minimal CLU record — user fills in real FSA numbers via the portal UI later
  const { data, error } = await supabase
    .from('clu_records')
    .insert({
      field_name: field_name,
      farm_name: field_name,
      fsa_acres: fsa_acres ?? 0,
      registry_field_id: registry_field_id,
      crop_year: CURRENT_CROP_YEAR,
      farm_number: 0,           // placeholder — user fills in real FSA farm number
      tract_number: 0,          // placeholder — user fills in real FSA tract number
      clu: field_name,          // use field name as CLU identifier placeholder
      reported: false,
      irrigated: false,
      organic: false,
      double_crop: false,
      cover_crop: false,
      prevented_planting: false,
    })
    .select()
    .single()

  if (error) {
    console.error('webhook field-created: insert error', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ record: data }, { status: 201 })
}
