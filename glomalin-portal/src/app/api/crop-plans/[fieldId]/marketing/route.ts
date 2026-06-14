import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { CURRENT_CROP_YEAR } from '@/lib/config'
import { instrumentPricedBu } from '@/lib/marketing/queries'
import type { SaleInstrument } from '@/lib/marketing/types'

export interface MarketingVariantResult {
  id: string
  name: string
  estimated_bu: number | null
  priced_bu: number
  pct_priced: number
}

export interface MarketingPositionResponse {
  variants: MarketingVariantResult[]
}

// Shape returned by the Supabase select (partial — only columns we request)
interface DbVariantRow {
  id: string
  name: string
  estimated_bu: number | null
  commodity_id: string
  crop_year: number
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fieldId: string }> }
): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const crop = searchParams.get('crop')?.trim()

  // fieldId is required by the route but not used in the query — the crop param
  // drives the lookup. Await params for Next.js 15 compatibility.
  await params

  if (!crop) {
    return NextResponse.json({ variants: [] })
  }

  try {
    const supabase = await createClient()

    // Auth guard
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Find crop_variants whose name matches the crop (ilike) for the current crop year
    const { data: variants, error: variantsError } = await supabase
      .from('crop_variants')
      .select('id, name, estimated_bu, commodity_id, crop_year')
      .eq('crop_year', CURRENT_CROP_YEAR)
      .ilike('name', `%${crop}%`)
      .order('name')

    if (variantsError) {
      // Non-critical — return empty rather than an error response
      return NextResponse.json({ variants: [] })
    }

    if (!variants || variants.length === 0) {
      return NextResponse.json({ variants: [] })
    }

    const typedVariants = variants as unknown as DbVariantRow[]
    const variantIds = typedVariants.map((v) => v.id)

    // 2. Fetch sale_instruments for those variants (only hard-priced instrument types)
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

    // Group instruments by variant_id
    const instByVariant = new Map<string, SaleInstrument[]>()
    for (const inst of (instruments ?? []) as unknown as SaleInstrument[]) {
      const key = inst.variant_id ?? '__none__'
      if (!instByVariant.has(key)) instByVariant.set(key, [])
      instByVariant.get(key)!.push(inst)
    }

    // 3. Compute priced_bu per variant using the shared instrumentPricedBu helper
    const results: MarketingVariantResult[] = typedVariants.map((v) => {
      const varInst = instByVariant.get(v.id) ?? []
      const priced_bu = varInst.reduce((sum, i) => sum + instrumentPricedBu(i), 0)
      const estimated = v.estimated_bu ?? 0
      const pct_priced = estimated > 0 ? Math.min(100, (priced_bu / estimated) * 100) : 0

      return {
        id: v.id,
        name: v.name,
        estimated_bu: v.estimated_bu,
        priced_bu,
        pct_priced,
      }
    })

    // Only return variants with estimated_bu > 0 to keep the UI clean
    const displayable = results.filter((r) => (r.estimated_bu ?? 0) > 0)

    return NextResponse.json({ variants: displayable })
  } catch {
    // Marketing position is non-critical — swallow all errors
    return NextResponse.json({ variants: [] })
  }
}
