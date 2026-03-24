import { NextResponse } from 'next/server'
import { fetchRegistryService } from '../../mobile/_lib/proxy'

/**
 * Proxy endpoint: forwards requests to farm-registry /api/fields/autocomplete
 * and returns field objects { id, name, aliases, reportingAcres, organicAcres, ownership }.
 *
 * Used by CLU card field selector to populate a dropdown from registry — eliminates
 * free-text field name entry and associates registry_field_id with each record.
 *
 * Client call: GET /api/registry/fields-autocomplete?q=airport
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') ?? ''
  const path = q ? `/api/fields/autocomplete?q=${encodeURIComponent(q)}` : '/api/fields/autocomplete'

  try {
    const resp = await fetchRegistryService(path)
    if (!resp.ok) {
      return NextResponse.json({ error: 'Farm registry unavailable' }, { status: 502 })
    }
    const data = await resp.json()
    // data.fields is the autocomplete result array
    return NextResponse.json(data.fields ?? [])
  } catch {
    return NextResponse.json({ error: 'Farm registry unavailable' }, { status: 502 })
  }
}
