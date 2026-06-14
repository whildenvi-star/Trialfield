import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CURRENT_CROP_YEAR } from '@/lib/config'
import { instrumentPricedBu } from '@/lib/marketing/queries'
import type { SaleInstrument } from '@/lib/marketing/types'

/**
 * GET /api/maps/field-scorecard?fieldId={registry_field_id}
 *
 * Returns best-effort scorecard data for a single field. All four sub-queries
 * run in parallel via Promise.allSettled — partial data is returned with nulls
 * for any section that fails.
 *
 * Response shape:
 *   {
 *     fieldId: string
 *     fsaAcres: number | null        — sum of fsa_acres from clu_records for this field
 *     polygonAcres: number | null    — reporting_acres from field_boundaries (if stored)
 *     aph: { crop_year, actual_yield, is_disaster_year }[]
 *     priced_bu: number | null
 *     estimated_bu: number | null
 *     open_claims: number
 *     recent_observations: number
 *   }
 */

interface AphRecord {
  crop_year: number
  actual_yield: number
  is_disaster_year: boolean
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const fieldId = searchParams.get('fieldId')

  if (!fieldId) {
    return NextResponse.json({ error: 'fieldId is required' }, { status: 400 })
  }

  const supabase = await createClient()

  // Auth guard
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── A. Acreage: field_boundaries (polygon area) + clu_records (FSA acreage) ──
  const acreageQuery = (async () => {
    const [boundaryResult, cluResult] = await Promise.allSettled([
      supabase
        .from('field_boundaries')
        .select('reporting_acres')
        .eq('registry_field_id', fieldId)
        .maybeSingle(),
      supabase
        .from('clu_records')
        .select('fsa_acres')
        .eq('registry_field_id', fieldId)
        .eq('crop_year', CURRENT_CROP_YEAR),
    ])

    const polygonAcres: number | null =
      boundaryResult.status === 'fulfilled' && !boundaryResult.value.error
        ? (boundaryResult.value.data?.reporting_acres ?? null)
        : null

    let fsaAcres: number | null = null
    if (cluResult.status === 'fulfilled' && !cluResult.value.error && cluResult.value.data) {
      const rows = cluResult.value.data as { fsa_acres: number | null }[]
      if (rows.length > 0) {
        const total = rows.reduce((sum, r) => sum + (r.fsa_acres ?? 0), 0)
        fsaAcres = total
      }
    }

    return { polygonAcres, fsaAcres }
  })()

  // ── B. APH yield trend (last 3 years) ─────────────────────────────────────────
  const aphQuery = (async (): Promise<AphRecord[]> => {
    const { data: boundary } = await supabase
      .from('field_boundaries')
      .select('name')
      .eq('registry_field_id', fieldId)
      .maybeSingle()

    const fieldName = boundary?.name
    if (!fieldName) return []

    const { data: policies } = await supabase
      .from('insurance_policies')
      .select('id')
      .ilike('farm_name', `%${fieldName}%`)

    if (!policies || policies.length === 0) return []

    const policyIds = policies.map((p: { id: string }) => p.id)

    const { data: aphRows } = await supabase
      .from('aph_records')
      .select('crop_year, actual_yield, is_disaster_year')
      .in('policy_id', policyIds)
      .order('crop_year', { ascending: false })
      .limit(3)

    if (!aphRows) return []

    return aphRows.map((r: { crop_year: number; actual_yield: number; is_disaster_year: boolean }) => ({
      crop_year: r.crop_year,
      actual_yield: r.actual_yield,
      is_disaster_year: r.is_disaster_year ?? false,
    }))
  })()

  // ── C. Marketing position ──────────────────────────────────────────────────────
  const marketingQuery = (async (): Promise<{ priced_bu: number; estimated_bu: number } | null> => {
    // Resolve field's crop via zone_year_attributes → management_zones
    const { data: zones } = await supabase
      .from('management_zones_geo')
      .select('id')
      .eq('registry_field_id', fieldId)

    if (!zones || zones.length === 0) return null

    const zoneIds = zones.map((z: { id: string }) => z.id)

    const { data: yearAttrs } = await supabase
      .from('zone_year_attributes')
      .select('crop')
      .in('zone_id', zoneIds)
      .eq('crop_year', CURRENT_CROP_YEAR)
      .not('crop', 'is', null)
      .limit(1)

    const crop = (yearAttrs?.[0] as { crop?: string | null } | undefined)?.crop
    if (!crop) return null

    const { data: variants } = await supabase
      .from('crop_variants')
      .select('id, estimated_bu')
      .eq('crop_year', CURRENT_CROP_YEAR)
      .ilike('name', `%${crop}%`)
      .gt('estimated_bu', 0)

    if (!variants || variants.length === 0) return null

    const variantIds = variants.map((v: { id: string }) => v.id)

    const { data: instruments } = await supabase
      .from('sale_instruments')
      .select(
        'id, commodity_id, variant_id, instrument_type, bushels, delivered_bu, daily_bu, ' +
          'weekly_bu, accumulation_start, accumulation_end, option_type, option_side, ' +
          'strike_price, premium_paid, expiry_date, ko_level, ki_level, leverage_ratio, ' +
          'price_per_bushel, basis, futures_reference, delivery_start, delivery_end, ' +
          'contract_number, buyer, counterparty, notes, created_at, updated_at, crop_year'
      )
      .eq('crop_year', CURRENT_CROP_YEAR)
      .in('variant_id', variantIds)
      .in('instrument_type', ['cash', 'forward_contract', 'hta'])

    const typedInstruments = (instruments ?? []) as unknown as SaleInstrument[]
    const typedVariants = variants as { id: string; estimated_bu: number | null }[]

    const priced_bu = typedInstruments.reduce((sum, i) => sum + instrumentPricedBu(i), 0)
    const estimated_bu = typedVariants.reduce((sum, v) => sum + (v.estimated_bu ?? 0), 0)

    return { priced_bu, estimated_bu }
  })()

  // ── D. Open claims + recent observations ──────────────────────────────────────
  const alertsQuery = (async (): Promise<{ open_claims: number; recent_observations: number }> => {
    // Get field name for the claims join
    const { data: boundary } = await supabase
      .from('field_boundaries')
      .select('name')
      .eq('registry_field_id', fieldId)
      .maybeSingle()

    const fieldName = boundary?.name

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const [claimsResult, obsResult] = await Promise.allSettled([
      // Open claims via farm_name match on insurance_policies → claims
      (async () => {
        if (!fieldName) return 0
        const { data: policies } = await supabase
          .from('insurance_policies')
          .select('id')
          .ilike('farm_name', `%${fieldName}%`)

        if (!policies || policies.length === 0) return 0
        const policyIds = policies.map((p: { id: string }) => p.id)

        const { count } = await supabase
          .from('claims')
          .select('id', { count: 'exact', head: true })
          .in('policy_id', policyIds)
          .neq('stage', 'closed')

        return count ?? 0
      })(),

      // Recent observations (last 30 days) — handle missing registry_field_id gracefully
      (async () => {
        try {
          const { count } = await supabase
            .from('field_observations')
            .select('id', { count: 'exact', head: true })
            .eq('registry_field_id', fieldId)
            .gte('created_at', thirtyDaysAgo)

          return count ?? 0
        } catch {
          return 0
        }
      })(),
    ])

    const open_claims = claimsResult.status === 'fulfilled' ? (claimsResult.value ?? 0) : 0
    const recent_observations = obsResult.status === 'fulfilled' ? (obsResult.value ?? 0) : 0

    return { open_claims, recent_observations }
  })()

  // ── Run all 4 in parallel ──────────────────────────────────────────────────────
  const [acreageResult, aphResult, marketingResult, alertsResult] = await Promise.allSettled([
    acreageQuery,
    aphQuery,
    marketingQuery,
    alertsQuery,
  ])

  const acreage = acreageResult.status === 'fulfilled' ? acreageResult.value : { polygonAcres: null, fsaAcres: null }
  const aph = aphResult.status === 'fulfilled' ? aphResult.value : []
  const marketing = marketingResult.status === 'fulfilled' ? marketingResult.value : null
  const alerts = alertsResult.status === 'fulfilled' ? alertsResult.value : { open_claims: 0, recent_observations: 0 }

  return NextResponse.json({
    fieldId,
    fsaAcres: acreage.fsaAcres,
    polygonAcres: acreage.polygonAcres,
    aph,
    priced_bu: marketing?.priced_bu ?? null,
    estimated_bu: marketing?.estimated_bu ?? null,
    open_claims: alerts.open_claims,
    recent_observations: alerts.recent_observations,
  })
}
