import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/maps/boundaries/:id
 *
 * Returns the current boundary + full edit history for a single field.
 * :id may be either the UUID (field_boundaries.id) or registry_field_id.
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // Resolve the boundary row — accept either UUID or registry_field_id
  const isUUID = /^[0-9a-f-]{36}$/i.test(id)
  const query = supabase
    .from('field_boundaries')
    .select('id, registry_field_id, name, geojson, centroid_lat, centroid_lng, total_acres, source, last_edited_at, imported_at')

  const { data: boundary, error: boundaryError } = await (
    isUUID
      ? query.eq('id', id).single()
      : query.eq('registry_field_id', id).single()
  )

  if (boundaryError || !boundary) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Fetch edit history
  const { data: history } = await supabase
    .from('field_boundary_history')
    .select('id, total_acres, replaced_at, source')
    .eq('field_boundary_id', boundary.id)
    .order('replaced_at', { ascending: false })

  return NextResponse.json({
    boundary,
    history: history ?? [],
  })
}

/**
 * PUT /api/maps/boundaries/:id
 *
 * Replaces the geometry for a field boundary.
 * Requires admin or agronomist role.
 * The old geometry is automatically archived to field_boundary_history via trigger.
 *
 * Body: { geometry: GeoJSON Geometry object (Polygon or MultiPolygon) }
 */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Role check
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'agronomist'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  let body: { geometry?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const geometry = body.geometry
  if (!geometry || typeof geometry !== 'object') {
    return NextResponse.json({ error: 'geometry is required' }, { status: 400 })
  }

  const geo = geometry as { type?: string; coordinates?: unknown }
  if (!['Polygon', 'MultiPolygon'].includes(geo.type ?? '')) {
    return NextResponse.json(
      { error: 'geometry.type must be Polygon or MultiPolygon' },
      { status: 400 }
    )
  }

  // Resolve the row UUID so we know what to update
  const isUUID = /^[0-9a-f-]{36}$/i.test(id)
  const { data: existing, error: lookupError } = await (
    isUUID
      ? supabase.from('field_boundaries').select('id').eq('id', id).single()
      : supabase.from('field_boundaries').select('id').eq('registry_field_id', id).single()
  )

  if (lookupError || !existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Build EWKT from GeoJSON geometry for PostgREST geometry column insert
  const ewkt = geoJsonToEwkt(geo)
  if (!ewkt) {
    return NextResponse.json({ error: 'Could not convert geometry to EWKT' }, { status: 400 })
  }

  // Use service role so the write bypasses RLS; auth check above already validated role
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: updated, error: updateError } = await serviceClient
    .from('field_boundaries')
    .update({
      geometry:       ewkt,
      geojson:        geometry,
      last_edited_at: new Date().toISOString(),
      last_edited_by: user.id,
    })
    .eq('id', existing.id)
    .select('id, registry_field_id, name, total_acres, last_edited_at')
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ boundary: updated })
}

/**
 * DELETE /api/maps/boundaries/:id
 *
 * Soft-deletes a boundary (sets is_deleted = true). Admin only.
 */
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  const { id } = await params
  const isUUID = /^[0-9a-f-]{36}$/i.test(id)

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await (
    isUUID
      ? serviceClient.from('field_boundaries').update({ is_deleted: true }).eq('id', id)
      : serviceClient.from('field_boundaries').update({ is_deleted: true }).eq('registry_field_id', id)
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function geoJsonToEwkt(geo: { type?: string; coordinates?: unknown }): string | null {
  try {
    const coordsStr = JSON.stringify(geo.coordinates)
    if (geo.type === 'Polygon') {
      return `SRID=4326;POLYGON(${formatRings(geo.coordinates as number[][][])})`
    }
    if (geo.type === 'MultiPolygon') {
      const rings = (geo.coordinates as number[][][][])
        .map((poly) => `(${formatRings(poly)})`)
        .join(', ')
      return `SRID=4326;MULTIPOLYGON(${rings})`
    }
    void coordsStr
    return null
  } catch {
    return null
  }
}

function formatRings(rings: number[][][]): string {
  return rings
    .map((ring) => `(${ring.map((pt) => `${pt[0]} ${pt[1]}`).join(', ')})`)
    .join(', ')
}
