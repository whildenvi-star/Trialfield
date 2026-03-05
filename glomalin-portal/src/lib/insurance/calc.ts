// Insurance Calc Engine — TypeScript port of fsa-acres/public/insurance.js
// Pure functions only — no Supabase calls, no side effects.
// Property names use snake_case to match Supabase column conventions.
// Use Array.from() for Set/Map iteration (tsconfig targets ES3 — see Phase 27-02 pitfall).

// ===== Type Definitions =====

export interface GrainFarm {
  farm: string
  crop: string
  acres: number
  totalBU: number
  yieldPerAcre: number
  ticketCount: number
}

// ===== Helpers =====

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ===== Name Normalization =====

/**
 * normName — lowercase, strip non-alphanumeric except spaces, collapse whitespace, trim.
 * Ported from fsa-acres/public/insurance.js.
 * Used for farm name and crop name matching between policies and CLU records / grain tickets.
 */
export function normName(n: string | null): string {
  return (n ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ===== APH Calculation =====

/**
 * computeAphFromClus — compute average APH from a set of CLU records.
 *
 * Uses simple average of non-zero APH values (not acre-weighted — simpler and sufficient
 * given all current CLU records have aph=0; revisit in Phase 30 if needed).
 *
 * Distinguishes between:
 *   - No matching CLUs found: totalRecords=0, count=0, avgAph=0
 *   - CLUs found but no APH values: totalRecords>0, count=0, avgAph=0
 *   - CLUs found with APH values: totalRecords>0, count>0, avgAph>0
 *
 * Callers should check count vs totalRecords to surface the correct message to users:
 *   - totalRecords=0: "No matching CLU records found"
 *   - totalRecords>0, count=0: "CLU records found but no APH entered"
 *   - count>0: show avgAph
 */
export function computeAphFromClus(
  clus: { aph: number | null; fsa_acres: number | null }[]
): { avgAph: number; count: number; totalRecords: number } {
  const totalRecords = clus.length
  const withAph = clus.filter((r) => r.aph !== null && r.aph > 0)
  const count = withAph.length

  if (count === 0) {
    return { avgAph: 0, count: 0, totalRecords }
  }

  const sum = withAph.reduce((acc, r) => acc + (r.aph ?? 0), 0)
  const avgAph = round2(sum / count)

  return { avgAph, count, totalRecords }
}

// ===== Claim Alert Detection =====

/**
 * computeClaimAlert — returns 'potential' when actual yield is below effective guarantee.
 *
 * Only flags 'potential' when BOTH actual > 0 AND guarantee > 0.
 * Avoids false alerts from corrupt data (e.g., ins_482 with actual=40000 and guarantee=0).
 *
 * Coverage level is stored as an integer (e.g., 75 = 75%). Divide by 100 to get the
 * decimal multiplier for the effective guarantee calculation.
 */
export function computeClaimAlert(policy: {
  guarantee: number
  actual: number
  coverage_level: number
}): 'none' | 'potential' {
  const { guarantee, actual, coverage_level } = policy

  // Guard against corrupt/missing data — require both values to be meaningful
  if (!guarantee || guarantee <= 0) return 'none'
  if (!actual || actual <= 0) return 'none'

  const effectiveGuarantee = guarantee * (coverage_level / 100)
  return actual < effectiveGuarantee ? 'potential' : 'none'
}

// ===== Grain Ticket Yield Matching =====

/**
 * findBestGrainMatch — score-based matching between an insurance policy and grain ticket farms.
 *
 * Ported from fsa-acres/public/insurance.js lines 514-535.
 *
 * Scoring:
 *   3 = farm name + crop match (highest confidence — apply automatically)
 *   2 = crop only match (medium confidence — apply automatically)
 *   1 = farm name only match (low confidence — do NOT apply; require manual confirmation)
 *   0 = no match
 *
 * Callers should only apply matches where score >= 2.
 * Score 1 (farm-only) matches are returned so the caller can surface them for manual review.
 *
 * Matching uses normName() on both sides — substring containment in either direction.
 * Example: policy farmName "KLUG, DAVIS" → "klug davis", grain farm "klug" → "klug"
 *          "klug davis".includes("klug") = true → match
 */
export function findBestGrainMatch(
  policy: { farm_name: string | null; crop: string | null },
  gtFarms: GrainFarm[]
): { match: GrainFarm | null; score: number } {
  const pFarm = normName(policy.farm_name)
  const pCrop = normName(policy.crop)

  let best: GrainFarm | null = null
  let bestScore = 0

  for (const f of gtFarms) {
    // Skip farms with no yield data
    if (f.yieldPerAcre <= 0) continue

    const gtFarm = normName(f.farm)
    const gtCrop = normName(f.crop)

    const nameMatch =
      pFarm.length > 0 &&
      gtFarm.length > 0 &&
      (pFarm.includes(gtFarm) || gtFarm.includes(pFarm))

    const cropMatch =
      pCrop.length > 0 &&
      gtCrop.length > 0 &&
      (gtCrop.includes(pCrop) || pCrop.includes(gtCrop))

    const score = nameMatch && cropMatch ? 3 : cropMatch ? 2 : nameMatch ? 1 : 0

    if (score > bestScore) {
      bestScore = score
      best = f
    }
  }

  return { match: best, score: bestScore }
}
