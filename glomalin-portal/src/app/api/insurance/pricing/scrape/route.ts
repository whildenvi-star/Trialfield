import { NextResponse } from 'next/server'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'

// POST /api/insurance/pricing/scrape
// Fetches current prices from USDA RMA Price Discovery API and updates insurance_pricing table.
// Only updates rows where manual_override is not true — preserves user-entered overrides.
// On failure: returns { ok: false } with error details but does NOT clear existing data.
export async function POST() {
  const guard = await requireModuleAccess('insurance')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  // 1. Get distinct crops from clu_records — scraper fetches only what's planted
  const { data: cluData, error: cluError } = await supabase
    .from('clu_records')
    .select('crop')

  if (cluError) {
    return NextResponse.json(
      { ok: false, error: 'Failed to query CLU records', message: cluError.message },
      { status: 200 }
    )
  }

  // Build a set of lowercase crop names from active CLU records
  const activeCrops = new Set<string>(
    (cluData ?? [])
      .map((r: { crop: string | null }) => (r.crop ?? '').trim().toLowerCase())
      .filter(Boolean)
  )

  // 2. Fetch from USDA RMA Price Discovery API
  const today = new Date()
  const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`
  const rmaUrl = `https://public-rma.fpac.usda.gov/apps/PriceDiscovery/Services/RevenuePriceDataService.svc/RevenuePrices?discoveryPeriodDate=${encodeURIComponent(dateStr)}`

  let rmaItems: Array<{ CommodityName?: string; ProjectedPrice?: string | number; HarvestPrice?: string | number }>
  try {
    const rmaRes = await fetch(rmaUrl, {
      signal: AbortSignal.timeout(10000),
      headers: { Accept: 'application/json' },
    })

    if (!rmaRes.ok) {
      return NextResponse.json(
        { ok: false, error: 'RMA returned non-OK status', message: `HTTP ${rmaRes.status}` },
        { status: 200 }
      )
    }

    const rmaData = await rmaRes.json()
    // RMA wraps items in .d for OData responses, otherwise top-level array
    const items = rmaData?.d ?? rmaData
    if (!Array.isArray(items)) {
      return NextResponse.json(
        { ok: true, updated: 0, total: 0, message: 'No price data returned from RMA', lastScraped: null },
        { status: 200 }
      )
    }
    rmaItems = items
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      { ok: false, error: 'Failed to reach USDA RMA', message: msg },
      { status: 200 }
    )
  }

  const total = rmaItems.length
  const lastScraped = new Date().toISOString()

  // 3. Build upsert rows for crops matching our active CLU records
  // Only include crops that appear in clu_records (adapt to what's actually planted)
  const upsertRows: Array<{
    crop: string
    spring_price?: number
    fall_price?: number
    last_scraped: string
    manual_override: boolean
  }> = []

  for (const item of rmaItems) {
    const cropName = (item.CommodityName ?? '').trim()
    if (!cropName) continue

    const lc = cropName.toLowerCase()
    // Only process crops that are in our active CLU records
    if (!activeCrops.has(lc)) continue

    const projected = parseFloat(String(item.ProjectedPrice)) || 0
    const harvest = parseFloat(String(item.HarvestPrice)) || 0

    // Only include non-zero values — don't zero out existing prices with missing data
    const row: { crop: string; spring_price?: number; fall_price?: number; last_scraped: string; manual_override: boolean } = {
      crop: cropName,
      last_scraped: lastScraped,
      manual_override: false,
    }
    if (projected > 0) row.spring_price = projected
    if (harvest > 0) row.fall_price = harvest

    upsertRows.push(row)
  }

  if (upsertRows.length === 0) {
    return NextResponse.json(
      {
        ok: true,
        updated: 0,
        total,
        message: 'No matching crops found in RMA data for current CLU records',
        lastScraped,
      },
      { status: 200 }
    )
  }

  // 4. Fetch existing pricing to skip manual_override rows
  const { data: existingPricing, error: fetchErr } = await supabase
    .from('insurance_pricing')
    .select('crop, manual_override')

  if (fetchErr) {
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch existing pricing', message: fetchErr.message },
      { status: 200 }
    )
  }

  // Build set of crops with manual_override = true — do not overwrite these
  const manualOverrideCrops = new Set<string>(
    (existingPricing ?? [])
      .filter((p: { crop: string; manual_override: boolean | null }) => p.manual_override === true)
      .map((p: { crop: string }) => p.crop.toLowerCase())
  )

  const rowsToUpsert = upsertRows.filter((r) => !manualOverrideCrops.has(r.crop.toLowerCase()))

  if (rowsToUpsert.length === 0) {
    return NextResponse.json(
      {
        ok: true,
        updated: 0,
        total,
        message: 'All matching crops have manual_override set — no updates made',
        lastScraped,
      },
      { status: 200 }
    )
  }

  // 5. Upsert into insurance_pricing — crop is the natural conflict key
  const { error: upsertError } = await supabase
    .from('insurance_pricing')
    .upsert(rowsToUpsert, { onConflict: 'crop' })

  if (upsertError) {
    return NextResponse.json(
      { ok: false, error: 'Failed to update pricing table', message: upsertError.message },
      { status: 200 }
    )
  }

  return NextResponse.json({
    ok: true,
    updated: rowsToUpsert.length,
    total,
    message: `${rowsToUpsert.length} prices updated from USDA RMA`,
    lastScraped,
  })
}
