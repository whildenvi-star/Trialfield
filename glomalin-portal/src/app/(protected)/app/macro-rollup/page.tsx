import { createClient } from '@/lib/supabase/server'
import { fetchBudgetService } from '@/app/api/mobile/_lib/proxy'
import { MacroRollupView } from '@/components/macro/macro-rollup-view'
import { CURRENT_CROP_YEAR } from '@/lib/config'
import type { FieldRow, ContractEntry } from '@/components/macro/field-table'

// ── Types for farm-budget /api/budget-field-details response ──────────────────

interface BudgetField {
  fieldId: string
  fieldName: string
  crop: string
  acres: number
  rentPerAcre: number
  fertPerAcre: number
  seedPerAcre: number
  machineryPerAcre: number
  laborPerAcre: number
  fuelPerAcre: number
  dryingPerAcre: number
  interestPerAcre: number
  insurancePerAcre: number
  expPerAcre: number
  cropIncomePerAcre: number
  profitPerAcre: number
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function MacroRollupPage() {
  // 1. Fetch farm-budget field details (costs + budget revenue per field)
  let budgetFields: BudgetField[] = []
  let budgetOffline = false

  try {
    const res = await fetchBudgetService('/api/budget-field-details')
    if (res.ok) {
      const data = await res.json() as { fields?: BudgetField[] }
      budgetFields = (data.fields ?? []).filter((f) => f.acres > 0)
    } else {
      budgetOffline = true
    }
  } catch {
    budgetOffline = true
  }

  // 2. Fetch grain contracts from Supabase
  const supabase = await createClient()
  const { data: contractData } = await supabase
    .from('grain_contracts')
    .select('id, crop, bushels, price_per_bushel, contract_type, buyer, delivery_start, delivery_end, crop_year')
    .eq('crop_year', CURRENT_CROP_YEAR)
    .order('crop')
    .order('created_at')

  const allContracts = contractData ?? []
  const hasContracts = allContracts.length > 0

  // 3. Build contract revenue by crop
  const contractsByCrop = new Map<string, typeof allContracts>()
  for (const c of allContracts) {
    const cropKey = (c.crop as string).toLowerCase()
    if (!contractsByCrop.has(cropKey)) contractsByCrop.set(cropKey, [])
    contractsByCrop.get(cropKey)!.push(c)
  }

  const contractRevByCrop = new Map<string, number>()
  contractsByCrop.forEach((contracts, cropKey) => {
    const rev = contracts.reduce((s: number, c: Record<string, unknown>) => {
      return s + (Number(c.bushels) || 0) * (Number(c.price_per_bushel) || 0)
    }, 0)
    contractRevByCrop.set(cropKey, rev)
  })

  // 4. Total budget acres per crop (denominator for proportional contract allocation)
  const totalAcresByCrop = new Map<string, number>()
  for (const f of budgetFields) {
    const key = f.crop.toLowerCase()
    totalAcresByCrop.set(key, (totalAcresByCrop.get(key) ?? 0) + f.acres)
  }

  // 5. Build per-field rows — always carry both projected and locked revenue
  const rows: FieldRow[] = budgetFields.map((f) => {
    const cropKey = f.crop.toLowerCase()
    const cropTotalAcres = totalAcresByCrop.get(cropKey) ?? 0

    // Contract (locked) revenue: proportional share of crop's total contracted revenue
    const cropRev = contractRevByCrop.get(cropKey) ?? 0
    const share = cropTotalAcres > 0 ? f.acres / cropTotalAcres : 0
    const revenue = hasContracts ? cropRev * share : null
    const revenuePerAcre = revenue !== null && f.acres > 0 ? revenue / f.acres : null

    // Contract list for detail panel
    const rawContracts = contractsByCrop.get(cropKey) ?? []
    const fieldContracts: ContractEntry[] = rawContracts.map((c) => ({
      id: c.id as string,
      buyer: c.buyer as string | null,
      contractType: c.contract_type as string,
      bushels: Number(c.bushels) || 0,
      pricePerBushel: c.price_per_bushel != null ? Number(c.price_per_bushel) : null,
      deliveryStart: c.delivery_start as string | null,
      deliveryEnd: c.delivery_end as string | null,
      total: c.price_per_bushel != null
        ? (Number(c.bushels) || 0) * Number(c.price_per_bushel)
        : null,
    }))

    const totalCost = f.expPerAcre * f.acres
    const margin = revenue !== null ? revenue - totalCost : null
    const marginPerAcre = margin !== null && f.acres > 0 ? margin / f.acres : null

    const missingData: string[] = []
    if (f.rentPerAcre === 0) missingData.push('Land rent')
    if (f.fertPerAcre === 0) missingData.push('Fertilizer costs')
    if (f.seedPerAcre === 0) missingData.push('Seed costs')

    return {
      fieldId: f.fieldId,
      fieldName: f.fieldName,
      crop: f.crop,
      acres: f.acres,
      totalCost,
      costPerAcre: f.expPerAcre,
      costBreakdown: {
        rent: f.rentPerAcre,
        fert: f.fertPerAcre,
        seed: f.seedPerAcre,
        machinery: f.machineryPerAcre,
        labor: f.laborPerAcre,
        fuel: f.fuelPerAcre,
        drying: f.dryingPerAcre,
        interest: f.interestPerAcre,
        insurance: f.insurancePerAcre,
      },
      revenue,
      revenuePerAcre,
      margin,
      marginPerAcre,
      budgetMarginPerAcre: f.profitPerAcre,
      budgetRevenuePerAcre: f.cropIncomePerAcre,
      contracts: fieldContracts,
      missingData,
    }
  })

  // Sort by projected margin desc
  rows.sort((a, b) => b.budgetMarginPerAcre - a.budgetMarginPerAcre)

  // 6. Pre-compute hero values for both modes (client toggle switches between them)
  const heroValueProjected = rows.length > 0
    ? rows.reduce((s, r) => s + r.budgetMarginPerAcre * r.acres, 0)
    : null

  const heroValueLocked = hasContracts && rows.length > 0
    ? rows.reduce((s, r) => s + (r.margin ?? 0), 0)
    : null

  return (
    <div className="min-h-screen bg-glomalin-bg text-glomalin-text">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <MacroRollupView
          rows={rows}
          hasContracts={hasContracts}
          budgetOffline={budgetOffline}
          heroValueProjected={heroValueProjected}
          heroValueLocked={heroValueLocked}
          cropYear={CURRENT_CROP_YEAR}
        />
      </div>
    </div>
  )
}
