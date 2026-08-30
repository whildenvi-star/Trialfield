import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchCertServiceWithAuth } from '@/app/api/mobile/_lib/proxy'

/**
 * GET /api/search/objects?q=north
 *
 * Object search for the command palette. Returns the *things* the farm runs on —
 * fields and contracts — not modules; the client already knows the module list
 * and matches it locally.
 *
 * Every source is wrapped in allSettled: if organic-cert is down, field results
 * still come back. A palette that fails closed when one service hiccups is worse
 * than one that returns less.
 */

const LIMIT_PER_KIND = 6

export interface ObjectHit {
  kind: 'field' | 'contract'
  id: string
  label: string
  sublabel: string
  route: string
  lat?: number | null
  lng?: number | null
}

interface ContractRow {
  id: string | number
  contractNumber?: string | null
  contract_number?: string | null
  buyer?: string | null
  customerName?: string | null
  crop?: string | null
  grainVariant?: string | null
  bushels?: number | null
  quantity?: number | null
  status?: string | null
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const q = (new URL(request.url).searchParams.get('q') ?? '').trim()
  if (q.length < 2) return NextResponse.json({ results: [] })

  // getSession is safe here: middleware validated the token before this handler.
  const { data: { session } } = await supabase.auth.getSession()

  const [fieldResult, contractResult] = await Promise.allSettled([
    supabase
      .from('field_boundaries')
      .select('registry_field_id, name, total_acres, centroid_lat, centroid_lng')
      .eq('is_deleted', false)
      .ilike('name', `%${q}%`)
      .order('name')
      .limit(LIMIT_PER_KIND),

    session?.access_token
      ? fetchCertServiceWithAuth('/api/marketing/contracts', session.access_token)
          .then((r) => (r.ok ? r.json() : null))
      : Promise.resolve(null),
  ])

  const results: ObjectHit[] = []

  if (fieldResult.status === 'fulfilled' && !fieldResult.value.error) {
    for (const row of fieldResult.value.data ?? []) {
      const acres = row.total_acres != null ? Number(row.total_acres) : null
      results.push({
        kind: 'field',
        id: row.registry_field_id,
        label: row.name,
        sublabel: acres != null ? `${acres.toFixed(1)} ac · field` : 'field',
        route: `/app/maps?field=${encodeURIComponent(row.registry_field_id)}`,
        lat: row.centroid_lat != null ? Number(row.centroid_lat) : null,
        lng: row.centroid_lng != null ? Number(row.centroid_lng) : null,
      })
    }
  }

  if (contractResult.status === 'fulfilled' && contractResult.value) {
    const payload = contractResult.value as unknown
    const rows: ContractRow[] = Array.isArray(payload)
      ? (payload as ContractRow[])
      : Array.isArray((payload as { contracts?: ContractRow[] })?.contracts)
        ? (payload as { contracts: ContractRow[] }).contracts
        : []

    const needle = q.toLowerCase()
    const matched = rows
      .filter((c) => {
        const number = c.contractNumber ?? c.contract_number ?? ''
        const buyer = c.buyer ?? c.customerName ?? ''
        const crop = c.crop ?? c.grainVariant ?? ''
        return `${number} ${buyer} ${crop}`.toLowerCase().includes(needle)
      })
      .slice(0, LIMIT_PER_KIND)

    for (const c of matched) {
      const number = c.contractNumber ?? c.contract_number ?? String(c.id)
      const buyer = c.buyer ?? c.customerName ?? ''
      const crop = c.crop ?? c.grainVariant ?? ''
      const bushels = c.bushels ?? c.quantity ?? null
      const parts = [buyer, crop, bushels != null ? `${Number(bushels).toLocaleString()} bu` : null]
        .filter(Boolean)
      results.push({
        kind: 'contract',
        id: String(c.id),
        label: number ? `Contract ${number}` : `Contract ${c.id}`,
        sublabel: parts.length ? parts.join(' · ') : 'contract',
        route: `/app/marketing?contract=${encodeURIComponent(String(c.id))}`,
      })
    }
  }

  return NextResponse.json({ results })
}
