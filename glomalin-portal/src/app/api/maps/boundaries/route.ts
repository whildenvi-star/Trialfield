import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/maps/boundaries
 *
 * Returns all field_boundaries rows as a GeoJSON FeatureCollection.
 * Each feature carries registry_field_id, name, centroid_lat, centroid_lng as properties.
 *
 * Requires authenticated session.
 */
export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: rows, error } = await supabase
    .from('field_boundaries')
    .select('registry_field_id, name, geojson, centroid_lat, centroid_lng')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const features = (rows ?? []).map((row) => ({
    type: 'Feature' as const,
    geometry: row.geojson,
    properties: {
      registry_field_id: row.registry_field_id,
      name: row.name,
      centroid_lat: row.centroid_lat ?? null,
      centroid_lng: row.centroid_lng ?? null,
    },
  }))

  return NextResponse.json({
    type: 'FeatureCollection',
    features,
  })
}
