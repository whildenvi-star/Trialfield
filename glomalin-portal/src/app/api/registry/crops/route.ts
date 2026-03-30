import { NextResponse } from 'next/server'
import { fetchRegistryService } from '../../mobile/_lib/proxy'

/**
 * Proxy endpoint: forwards requests to farm-registry /api/crops/autocomplete
 * and returns crop name suggestions for the contract drawer autocomplete.
 *
 * The dedicated /api/crops/autocomplete endpoint supports ?q= filtering
 * and returns a lightweight { crops: [{id, name, category, organic}] } shape.
 *
 * Client call: GET /api/registry/crops?q=corn
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') ?? ''
  const path = q
    ? `/api/crops/autocomplete?q=${encodeURIComponent(q)}`
    : '/api/crops/autocomplete'

  try {
    const resp = await fetchRegistryService(path)
    if (!resp.ok) {
      return NextResponse.json({ error: 'Farm registry unavailable' }, { status: 502 })
    }
    const data = await resp.json()
    // farm-registry returns { crops: [...] }
    return NextResponse.json(data.crops ?? [])
  } catch {
    return NextResponse.json({ error: 'Farm registry unavailable' }, { status: 502 })
  }
}
