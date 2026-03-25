import { NextResponse } from 'next/server'
import { fetchRegistryService } from '../../mobile/_lib/proxy'

/**
 * Proxy endpoint: forwards requests to farm-registry /api/crops
 * and returns crop objects { id, name, category, organic }.
 *
 * Used by CropTypeahead and fsa-crop-list to populate crop dropdowns from registry
 * instead of a hardcoded list. No local fallback — registry down = visible error.
 *
 * Client call: GET /api/registry/crops-autocomplete
 */
export async function GET() {
  try {
    const resp = await fetchRegistryService('/api/crops')
    if (!resp.ok) {
      return NextResponse.json({ error: 'Farm registry unavailable' }, { status: 502 })
    }
    const data = await resp.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Farm registry unavailable' }, { status: 502 })
  }
}
