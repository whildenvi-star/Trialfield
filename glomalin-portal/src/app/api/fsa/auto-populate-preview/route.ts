import { NextResponse } from 'next/server'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'
import { fetchBudgetService } from '@/app/api/mobile/_lib/proxy'
import { CURRENT_CROP_YEAR } from '@/lib/config'

// ===== Types =====

interface AutoPopulateProposal {
  cluId: string
  legacyId: string
  fieldName: string | null
  farmNumber: string
  tractNumber: string
  clu: string
  fsaAcres: number
  currentCrop: string | null
  proposedCrop: string | null
  matchConfidence: 'exact' | 'suggested' | 'none'
}

type BudgetCrop = { displayName: string; budgetAcres: number }

// ===== Helpers =====

function normName(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim()
}

function buildAutoPopulateProposals(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  budgetData: any,
  cluRecords: Array<{
    id: string
    legacy_id: string
    farm_number: string
    tract_number: string
    clu: string
    field_name: string | null
    crop: string | null
    fsa_acres: number
  }>
): { proposals: AutoPopulateProposal[]; budgetCrops: Map<string, BudgetCrop> } {
  // Build a map of budget crops from enterprise summaries
  const budgetCrops = new Map<string, BudgetCrop>()

  const enterprises: unknown[] = budgetData?.enterpriseSummaries ?? budgetData?.enterprises ?? []

  for (const enterprise of enterprises) {
    if (!enterprise || typeof enterprise !== 'object') continue
    const ent = enterprise as Record<string, unknown>

    // Extract crop name — various field names used by farm-budget API
    const name =
      (ent.cropName as string) ||
      (ent.name as string) ||
      (ent.crop as string) ||
      (ent.enterprise as string) ||
      ''
    if (!name) continue

    const acres =
      typeof ent.totalAcres === 'number'
        ? ent.totalAcres
        : typeof ent.acres === 'number'
          ? ent.acres
          : 0

    const key = normName(name)
    if (!budgetCrops.has(key)) {
      budgetCrops.set(key, { displayName: name, budgetAcres: acres })
    } else {
      // Accumulate acres across multiple enterprise entries for the same crop
      const existing = budgetCrops.get(key)!
      existing.budgetAcres += acres
    }
  }

  // Track how many budget acres have been matched to CLU records (for suggested matching)
  const matchedAcres = new Map<string, number>()
  for (const [key] of Array.from(budgetCrops)) {
    matchedAcres.set(key, 0)
  }

  // First pass: identify exact matches so we don't use those acres for suggestions
  const exactMatched = new Set<string>()
  for (const r of cluRecords) {
    if (!r.crop) continue
    const normCrop = normName(r.crop)
    if (budgetCrops.has(normCrop)) {
      exactMatched.add(normCrop)
      const prev = matchedAcres.get(normCrop) ?? 0
      matchedAcres.set(normCrop, prev + (r.fsa_acres || 0))
    }
  }

  // Build proposals for ALL CLU records
  const proposals: AutoPopulateProposal[] = []

  for (const r of cluRecords) {
    const normCrop = r.crop ? normName(r.crop) : ''

    if (r.crop && normCrop && budgetCrops.has(normCrop)) {
      // Exact normalized match — propose same crop as confirmation
      proposals.push({
        cluId: r.id,
        legacyId: r.legacy_id,
        fieldName: r.field_name,
        farmNumber: r.farm_number,
        tractNumber: r.tract_number,
        clu: r.clu,
        fsaAcres: r.fsa_acres,
        currentCrop: r.crop,
        proposedCrop: r.crop,
        matchConfidence: 'exact',
      })
    } else if (!r.crop || !normCrop) {
      // No crop assigned — find budget crop with most remaining unmatched acres
      let bestKey: string | null = null
      let bestAcres = -1

      for (const [key, bc] of Array.from(budgetCrops)) {
        const used = matchedAcres.get(key) ?? 0
        const remaining = bc.budgetAcres - used
        if (remaining > bestAcres) {
          bestAcres = remaining
          bestKey = key
        }
      }

      if (bestKey !== null && bestAcres > 0) {
        const bc = budgetCrops.get(bestKey)!
        // Reserve these CLU acres against the budget crop
        const prev = matchedAcres.get(bestKey) ?? 0
        matchedAcres.set(bestKey, prev + (r.fsa_acres || 0))

        proposals.push({
          cluId: r.id,
          legacyId: r.legacy_id,
          fieldName: r.field_name,
          farmNumber: r.farm_number,
          tractNumber: r.tract_number,
          clu: r.clu,
          fsaAcres: r.fsa_acres,
          currentCrop: r.crop,
          proposedCrop: bc.displayName,
          matchConfidence: 'suggested',
        })
      } else {
        proposals.push({
          cluId: r.id,
          legacyId: r.legacy_id,
          fieldName: r.field_name,
          farmNumber: r.farm_number,
          tractNumber: r.tract_number,
          clu: r.clu,
          fsaAcres: r.fsa_acres,
          currentCrop: r.crop,
          proposedCrop: null,
          matchConfidence: 'none',
        })
      }
    } else {
      // Has a crop but it doesn't match any budget crop
      proposals.push({
        cluId: r.id,
        legacyId: r.legacy_id,
        fieldName: r.field_name,
        farmNumber: r.farm_number,
        tractNumber: r.tract_number,
        clu: r.clu,
        fsaAcres: r.fsa_acres,
        currentCrop: r.crop,
        proposedCrop: r.crop, // keep existing crop
        matchConfidence: 'none',
      })
    }
  }

  return { proposals, budgetCrops }
}

// ===== Route Handler =====

export async function GET() {
  const guard = await requireModuleAccess('fsa-578')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  // Fetch farm-budget dashboard — use proxy helper to include embed_session auth cookie
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let budgetData: any
  try {
    const res = await fetchBudgetService('/api/dashboard')
    if (!res.ok) throw new Error(`Budget returned ${res.status}`)
    budgetData = await res.json()
  } catch {
    return NextResponse.json(
      { error: 'Farm-budget is offline — auto-populate unavailable' },
      { status: 502 }
    )
  }

  // Fetch CLU records from Supabase (only fields needed for proposal matching)
  const { data: cluRecords, error: cluError } = await supabase
    .from('clu_records')
    .select('id, legacy_id, farm_number, tract_number, clu, field_name, crop, fsa_acres')
    .eq('crop_year', CURRENT_CROP_YEAR)

  if (cluError) {
    return NextResponse.json(
      { error: 'Failed to fetch CLU records', details: cluError.message },
      { status: 500 }
    )
  }

  const records = cluRecords ?? []

  const { proposals, budgetCrops } = buildAutoPopulateProposals(budgetData, records)

  return NextResponse.json({
    proposals,
    budgetCropCount: budgetCrops.size,
    cluCount: records.length,
  })
}
