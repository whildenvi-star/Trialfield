// FSA Acres Calc Engine — TypeScript port of fsa-acres/public/calc.js
// Property names use snake_case to match Supabase column conventions.
// All function signatures and logic are preserved from the original.

// ===== Helpers =====

/** Detect organic crop from name conventions (e.g. "Org Peas", "Organic SRWW") */
export function isOrganicCrop(crop: string | null | undefined): boolean {
  if (!crop) return false
  return /\borg\b/i.test(crop) || /organic/i.test(crop)
}

// ===== Type Definitions =====

export interface CluRecord {
  id: string
  legacy_id: string
  crop_year: number
  farm_number: string
  tract_number: string
  clu: string
  field_name: string | null
  registry_field_id: string | null
  farm_name: string | null
  fsa_acres: number
  crop: string | null
  registry_crop_id: string | null  // canonical crop ID from farm-registry
  irrigated: boolean
  organic: boolean
  double_crop: boolean
  cover_crop: boolean
  grain_plant_date: string | null
  use: string | null
  reported: boolean
  tillage_2024: string | null
  tillage_2025: string | null
  cc_2024: string | null
  cc_2025: string | null
  nt_adoption_2024: string | null
  nt_adoption_2025: string | null
  cc_adoption_2024: string | null
  cc_adoption_2025: string | null
  unit_number: string | null
  aph: number | null
  line_number: string | null
  policy_number: string | null
  prevented_planting: boolean
}

export interface PricingEntry {
  id: string
  legacy_id: string
  crop: string
  year: number
  spring_price: number
  fall_price: number
  manual_override: boolean
}

export interface InsurancePolicy {
  id: string
  legacy_id: string
  farm_name: string | null
  farm_number: string | null
  line_number?: string | null
  policy_number?: string | null
  crop: string | null
  policy_year: number
  planted_acres: number
  fsa_acres_manual: number | null
  guarantee: number
  actual: number
  coverage_level: number
  unit_type: string | null
  premium_per_acre: number | null
  // Phase 30: plan type for RP / RP-HPE / YP comparison matrix
  plan_type?: string | null
  // Phase 29 columns — optional since legacy records may predate these columns
  aph_computed?: number | null
  aph_clu_count?: number | null
  actual_synced_from_grain?: boolean
  claim_alert?: string
  // Additional optional fields
  agent_name?: string | null
  notes?: string | null
  prevented_planting: boolean
  prevented_planting_acres: number | null
  yield_synced_at?: string | null
}

export interface GcsEnrollment {
  id: string
  legacy_id: string
  farm_number: string
  tract_number: string
  field_id: string
  commodity: string | null
  cc340_acres: number
  rt345_acres: number
  nt329_acres: number
  default_yield: number | null
  irrigation: string | null
  tillage: string | null
  state: string
  county: string
}

export interface ValidationWarning {
  type: 'missing-crop' | 'missing-date' | 'missing-price' | 'no-insurance' | 'unreported'
  severity: 'error' | 'warning' | 'info'
  message: string
  count: number
  filter?: Record<string, string>
  details?: Array<{ crop: string; acres: number }>
}

// ===== Constants =====

export const TILLAGE_CODES: Record<string, string> = {
  A: 'No Till',
  B: 'Strip Till',
  C: 'Fall Vertical',
  D: 'Spring Vertical',
  E: 'Fall Field Cultivation',
  E2: 'Spring Field Cultivation',
  F: 'Disk Ripper',
  G: 'Reduced Till',
}

// ===== Helpers =====

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function findPrice(pricing: PricingEntry[], crop: string | null): PricingEntry | null {
  if (!crop) return null
  const lc = crop.toLowerCase().trim()
  for (const entry of pricing) {
    if (entry.crop.toLowerCase().trim() === lc) return entry
  }
  return null
}

// ===== Rollups =====

export function rollupByFarm(records: CluRecord[]) {
  const map: Record<
    string,
    {
      farm_number: string
      farm_name: string
      totalAcres: number
      dryAcres: number
      irrigatedAcres: number
      organicAcres: number
    }
  > = {}

  for (const r of records) {
    const key = r.farm_number || 'Unknown'
    if (!map[key]) {
      map[key] = {
        farm_number: key,
        farm_name: r.farm_name || '',
        totalAcres: 0,
        dryAcres: 0,
        irrigatedAcres: 0,
        organicAcres: 0,
      }
    }
    const ac = r.fsa_acres || 0
    map[key].totalAcres += ac
    if (r.irrigated) map[key].irrigatedAcres += ac
    else map[key].dryAcres += ac
    if (r.organic) map[key].organicAcres += ac
    if (!map[key].farm_name && r.farm_name) map[key].farm_name = r.farm_name
  }

  return Object.values(map)
    .map((e) => ({
      ...e,
      totalAcres: round2(e.totalAcres),
      dryAcres: round2(e.dryAcres),
      irrigatedAcres: round2(e.irrigatedAcres),
      organicAcres: round2(e.organicAcres),
    }))
    .sort((a, b) => b.totalAcres - a.totalAcres)
}

export function rollupByCrop(records: CluRecord[]) {
  const map: Record<
    string,
    {
      crop: string
      dryAcres: number
      irrigatedAcres: number
      organicAcres: number
      totalAcres: number
    }
  > = {}

  for (const r of records) {
    const crop = r.crop || '(no crop)'
    if (!map[crop]) {
      map[crop] = { crop, dryAcres: 0, irrigatedAcres: 0, organicAcres: 0, totalAcres: 0 }
    }
    const ac = r.fsa_acres || 0
    map[crop].totalAcres += ac
    if (r.irrigated) map[crop].irrigatedAcres += ac
    else map[crop].dryAcres += ac
    if (r.organic) map[crop].organicAcres += ac
  }

  return Object.values(map)
    .map((e) => ({
      ...e,
      totalAcres: round2(e.totalAcres),
      dryAcres: round2(e.dryAcres),
      irrigatedAcres: round2(e.irrigatedAcres),
      organicAcres: round2(e.organicAcres),
    }))
    .sort((a, b) => b.totalAcres - a.totalAcres)
}

export function rollupByField(records: CluRecord[], farmNumber?: string) {
  const filtered = farmNumber
    ? records.filter((r) => r.farm_number === farmNumber)
    : records

  const map: Record<
    string,
    {
      field_name: string
      farm_number: string
      crops: Record<
        string,
        { crop: string; dryAcres: number; irrigatedAcres: number; totalAcres: number }
      >
      totalAcres: number
    }
  > = {}

  for (const r of filtered) {
    const key = r.field_name || '(unnamed)'
    if (!map[key]) {
      map[key] = {
        field_name: key,
        farm_number: r.farm_number,
        crops: {},
        totalAcres: 0,
      }
    }
    const crop = r.crop || '(no crop)'
    if (!map[key].crops[crop]) {
      map[key].crops[crop] = { crop, dryAcres: 0, irrigatedAcres: 0, totalAcres: 0 }
    }
    const ac = r.fsa_acres || 0
    map[key].crops[crop].totalAcres += ac
    map[key].totalAcres += ac
    if (r.irrigated) map[key].crops[crop].irrigatedAcres += ac
    else map[key].crops[crop].dryAcres += ac
  }

  return Object.keys(map)
    .sort()
    .map((k) => {
      const e = map[k]
      const cropArr = Object.values(e.crops).map((ce) => ({
        ...ce,
        totalAcres: round2(ce.totalAcres),
        dryAcres: round2(ce.dryAcres),
        irrigatedAcres: round2(ce.irrigatedAcres),
      }))
      return {
        field_name: e.field_name,
        farm_number: e.farm_number,
        crops: cropArr,
        totalAcres: round2(e.totalAcres),
      }
    })
}

export function rollupByTract(records: CluRecord[], farmNumber?: string) {
  const filtered = farmNumber
    ? records.filter((r) => r.farm_number === farmNumber)
    : records

  const map: Record<
    string,
    {
      tract_number: string
      farm_number: string
      totalAcres: number
      dryAcres: number
      irrigatedAcres: number
    }
  > = {}

  for (const r of filtered) {
    const key = r.tract_number || '(unknown)'
    if (!map[key]) {
      map[key] = {
        tract_number: key,
        farm_number: r.farm_number,
        totalAcres: 0,
        dryAcres: 0,
        irrigatedAcres: 0,
      }
    }
    const ac = r.fsa_acres || 0
    map[key].totalAcres += ac
    if (r.irrigated) map[key].irrigatedAcres += ac
    else map[key].dryAcres += ac
  }

  return Object.keys(map)
    .sort()
    .map((k) => {
      const e = map[k]
      return {
        ...e,
        totalAcres: round2(e.totalAcres),
        dryAcres: round2(e.dryAcres),
        irrigatedAcres: round2(e.irrigatedAcres),
      }
    })
}

export function summaryMetrics(records: CluRecord[]) {
  let total = 0
  let organic = 0
  let irrigated = 0
  let coverCropped = 0
  let reported = 0

  for (const r of records) {
    const ac = r.fsa_acres || 0
    total += ac
    if (r.organic) organic += ac
    if (r.irrigated) irrigated += ac
    if (r.cover_crop || r.cc_2024 || r.cc_2025) coverCropped += ac
    if (r.reported) reported += ac
  }

  const farmSet = new Set(records.map((r) => r.farm_number))

  return {
    totalAcres: round2(total),
    organicAcres: round2(organic),
    irrigatedAcres: round2(irrigated),
    coverCroppedAcres: round2(coverCropped),
    reportedAcres: round2(reported),
    recordCount: records.length,
    farmCount: farmSet.size,
  }
}

// ===== Insurance =====

export function computeInsurancePolicy(policy: InsurancePolicy, pricing: PricingEntry[]) {
  // Note: original calc.js signature was (policy, cluRecords, pricing) but plan spec
  // specifies (policy, pricing) — the clu-based FSA acres sum is handled separately.
  // We match the plan spec here: pricing array only, no CLU cross-reference needed for
  // the UI payout simulator use case.
  const price = findPrice(pricing, policy.crop)
  const springPrice = price ? price.spring_price : 0
  const fallPrice = price ? price.fall_price : 0
  const highestPrice = Math.max(springPrice, fallPrice)

  const guarantee = policy.guarantee || 0
  const actual = policy.actual || 0
  const plantedAcres = policy.planted_acres || 0
  const coverageLevel = policy.coverage_level || 75
  const effectiveGuarantee = round2(guarantee * (coverageLevel / 100))
  const shortfall = Math.max(0, effectiveGuarantee - actual)
  const dollarGuarantee = round2(effectiveGuarantee * highestPrice * plantedAcres)
  const indemnity = round2(shortfall * highestPrice * plantedAcres)
  const totalPremium = round2((policy.premium_per_acre || 0) * plantedAcres)

  return {
    springPrice,
    fallPrice,
    highestPrice,
    effectiveGuarantee,
    dollarGuarantee,
    shortfall,
    indemnity,
    totalPremium,
    coverageLevel,
    // Derived convenience fields
    potentialLoss: indemnity,
    payoutEstimate: indemnity,
    projectedRevenue: round2(actual * highestPrice * plantedAcres),
  }
}

// ===== Validation =====

export function validateCluRecords(
  records: CluRecord[],
  pricing: PricingEntry[],
  policies: InsurancePolicy[]
): ValidationWarning[] {
  const warnings: ValidationWarning[] = []

  // Missing crop — severity corrected to 'error' (original: 'warning')
  const noCrop = records.filter((r) => !r.crop || !r.crop.trim())
  if (noCrop.length > 0) {
    const acres = round2(noCrop.reduce((sum, r) => sum + (r.fsa_acres || 0), 0))
    warnings.push({
      type: 'missing-crop',
      severity: 'error',
      message: `${noCrop.length} CLU records have no crop assigned (${acres} acres)`,
      filter: { crop: '' },
      count: noCrop.length,
    })
  }

  // Missing plant date (has crop but no grain_plant_date) — severity corrected to 'error' (original: 'info')
  const noDate = records.filter(
    (r) => r.crop && r.crop.trim() && (!r.grain_plant_date || !r.grain_plant_date.trim())
  )
  if (noDate.length > 0) {
    warnings.push({
      type: 'missing-date',
      severity: 'error',
      message: `${noDate.length} CLU records have a crop but no planting date`,
      filter: { grain_plant_date: '' },
      count: noDate.length,
    })
  }

  // Unreported records — severity corrected to 'warning' (original: 'info')
  const unreported = records.filter((r) => !r.reported)
  if (unreported.length > 0) {
    warnings.push({
      type: 'unreported',
      severity: 'warning',
      message: `${unreported.length} CLU records not yet reported to FSA`,
      filter: { reported: 'false' },
      count: unreported.length,
    })
  }

  // No insurance — crops > 10ac total without a matching policy — severity: 'warning'
  const cropAcres: Record<string, number> = {}
  for (const r of records) {
    if (r.crop && r.crop.trim()) {
      const key = r.crop.trim().toLowerCase()
      cropAcres[key] = (cropAcres[key] || 0) + (r.fsa_acres || 0)
    }
  }
  const insuredCrops = new Set(
    (policies || [])
      .filter((p) => p.crop && p.crop.trim())
      .map((p) => p.crop!.trim().toLowerCase())
  )
  for (const [crop, acres] of Object.entries(cropAcres)) {
    if (!insuredCrops.has(crop) && acres >= 10) {
      warnings.push({
        type: 'no-insurance',
        severity: 'warning',
        message: `Crop '${crop}' has ${round2(acres)} acres but no insurance policy`,
        count: 1,
        details: [{ crop, acres: round2(acres) }],
      })
    }
  }

  // Missing price — crops without pricing entry — severity: 'info' (demoted from original 'warning')
  const cropSet = new Set(
    records
      .filter((r) => r.crop && r.crop.trim())
      .map((r) => r.crop!.trim())
  )
  const pricedCrops = new Set(
    (pricing || [])
      .filter((p) => p.crop)
      .map((p) => p.crop.toLowerCase().trim())
  )
  for (const crop of Array.from(cropSet)) {
    if (!pricedCrops.has(crop.toLowerCase().trim())) {
      warnings.push({
        type: 'missing-price',
        severity: 'info',
        message: `No price data for crop '${crop}'`,
        count: 1,
      })
    }
  }

  return warnings
}

// ===== Reporting Progress =====

export function reportingProgress(records: CluRecord[]) {
  const map: Record<
    string,
    {
      farm_number: string
      total: number
      reported: number
      unreported: number
      totalAcres: number
      reportedAcres: number
      unreportedAcres: number
      pct?: number
    }
  > = {}

  for (const r of records) {
    const fn = r.farm_number || 'Unknown'
    if (!map[fn]) {
      map[fn] = {
        farm_number: fn,
        total: 0,
        reported: 0,
        unreported: 0,
        totalAcres: 0,
        reportedAcres: 0,
        unreportedAcres: 0,
      }
    }
    map[fn].total++
    const ac = r.fsa_acres || 0
    map[fn].totalAcres += ac
    if (r.reported) {
      map[fn].reported++
      map[fn].reportedAcres += ac
    } else {
      map[fn].unreported++
      map[fn].unreportedAcres += ac
    }
  }

  return Object.keys(map)
    .sort()
    .map((k) => {
      const e = map[k]
      return {
        ...e,
        pct: e.total > 0 ? Math.round((e.reported / e.total) * 100) : 0,
        totalAcres: round2(e.totalAcres),
        reportedAcres: round2(e.reportedAcres),
        unreportedAcres: round2(e.unreportedAcres),
      }
    })
}

// ===== Tillage Summary =====

export function tillageSummary(records: CluRecord[]) {
  // Returns an array of entries for both 2024 and 2025 tillage data
  const years = [2024, 2025] as const
  const result: Array<{
    year: number
    code: string
    label: string
    acres: number
    count: number
    newPracticeAcres: number
    earlyAdopterAcres: number
  }> = []

  for (const year of years) {
    const tillageField = year === 2024 ? 'tillage_2024' : 'tillage_2025'
    const ntField = year === 2024 ? 'nt_adoption_2024' : 'nt_adoption_2025'

    const map: Record<
      string,
      {
        code: string
        label: string
        acres: number
        count: number
        newPracticeAcres: number
        earlyAdopterAcres: number
      }
    > = {}

    for (const r of records) {
      const code = r[tillageField as keyof CluRecord] as string | null
      if (!code) continue
      if (!map[code]) {
        map[code] = {
          code,
          label: TILLAGE_CODES[code] || code,
          acres: 0,
          count: 0,
          newPracticeAcres: 0,
          earlyAdopterAcres: 0,
        }
      }
      const ac = r.fsa_acres || 0
      map[code].acres += ac
      map[code].count++
      const nt = (r[ntField as keyof CluRecord] as string | null) || ''
      if (nt === 'New Practice') map[code].newPracticeAcres += ac
      else if (nt === 'Early adopter') map[code].earlyAdopterAcres += ac
    }

    for (const code of Object.keys(map).sort()) {
      const e = map[code]
      result.push({
        year,
        code: e.code,
        label: e.label,
        acres: round2(e.acres),
        count: e.count,
        newPracticeAcres: round2(e.newPracticeAcres),
        earlyAdopterAcres: round2(e.earlyAdopterAcres),
      })
    }
  }

  return result
}

// ===== Cover Crop Summary =====

export function coverCropSummary(records: CluRecord[]) {
  // Returns cover crop adoption stats for both 2024 and 2025
  const years = [2024, 2025] as const
  const result: Array<{ year: number; species: string; acres: number }> = []

  for (const year of years) {
    const field = year === 2024 ? 'cc_2024' : 'cc_2025'
    const map: Record<string, { species: string; acres: number }> = {}

    for (const r of records) {
      const species = r[field as keyof CluRecord] as string | null
      if (!species) continue
      const key = species.toLowerCase().trim()
      if (!map[key]) map[key] = { species, acres: 0 }
      map[key].acres += r.fsa_acres || 0
    }

    const yearEntries = Object.values(map)
      .map((e) => ({ year, species: e.species, acres: round2(e.acres) }))
      .sort((a, b) => b.acres - a.acres)

    result.push(...yearEntries)
  }

  return result
}

// ===== Management Zone Types =====

export interface ManagementZone {
  id: string
  registry_field_id: string | null
  name: string
  geometry: GeoJSON.Polygon | null
  organic_default: boolean
  irrigated_default: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ZoneYearAttributes {
  id: string
  zone_id: string
  crop_year: number
  crop: string | null
  variety: string | null
  irrigated: boolean | null          // null = inherit zone default
  organic: boolean | null            // null = inherit zone default
  intended_use: string | null        // 'grain' | 'forage' | 'seed' | 'silage'
  tillage: string | null             // A-G code
  cover_crop: boolean | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CluBoundary {
  id: string
  crop_year: number
  farm_number: string
  tract_number: string
  clu_label: string
  geometry: GeoJSON.Polygon | null
  fsa_acres: number | null
  fsa_attributes: Record<string, unknown>  // verbatim .dbf fields
  source_file: string | null
  imported_at: string
}

export interface CoverageEvent {
  id: string
  zone_id: string | null
  crop_year: number
  source_adapter: 'fieldview' | 'jd_ops' | 'cnh_fieldops' | 'manual'
  operation_type: 'planting' | 'application' | 'harvest'
  op_date: string | null
  geometry: GeoJSON.Polygon | null
  applied_acres: number | null
  product: string | null
  rate: number | null
  rate_unit: string | null
  raw_payload: Record<string, unknown>
  imported_at: string
}

export interface PracticeLedgerEntry {
  id: string
  zone_id: string
  crop_year: number
  practice_code: string              // '340' | '345' | '329' | custom
  value: string | null
  source: 'user' | 'coverage_event' | 'shapefile_import'
  recorded_at: string
}

export interface RotationRule {
  id: string
  name: string
  crop: string
  rule_type: 'max_frequency' | 'cannot_follow'
  max_frequency_years: number | null
  cannot_follow_crop: string | null
  cannot_follow_product: string | null
  notes: string | null
  active: boolean
  created_at: string
}

// ===== Reconciliation Types =====

export type ReconciliationStatus = 'ok' | 'flagged' | 'unresolved'

export type ReconciliationCause =
  | 'within_tolerance'
  | 'unmapped_waterway'
  | 'boundary_creep'
  | 'split_not_recognized'
  | 'missing_coverage_data'
  | 'manual_entry_error'
  | 'unknown'

export interface ReconciliationRow {
  clu_boundary_id: string
  clu_label: string
  farm_number: string
  tract_number: string
  zone_ids: string[]                 // management zones intersecting this CLU
  zone_names: string[]
  as_applied_acres: number           // from coverage_events intersection
  fsa_declared_acres: number         // from clu_boundaries.fsa_acres
  delta: number                      // as_applied - fsa_declared
  status: ReconciliationStatus
  cause: ReconciliationCause
  // Pre-filled from coverage data; confirmed by office person
  suggested_crop: string | null
  confirmed_crop: string | null
  irrigated: boolean
  organic: boolean
}

/** Apply the 0.1 ac flat tolerance rule from the design brief. */
export function reconciliationStatus(delta: number): ReconciliationStatus {
  if (Math.abs(delta) <= 0.1) return 'ok'
  if (Math.abs(delta) <= 1.0) return 'flagged'
  return 'unresolved'
}

/** Heuristic cause attribution for reconciliation deltas. */
export function attributeCause(
  delta: number,
  cluAcres: number,
  adjacentCluExists: boolean
): ReconciliationCause {
  const absDelta = Math.abs(delta)
  if (absDelta <= 0.1) return 'within_tolerance'
  // Small delta on a small CLU → likely unmapped waterway or wet area
  if (absDelta < 0.5 && cluAcres < 20) return 'unmapped_waterway'
  // Large delta that matches an adjacent CLU's size → boundary creep
  if (adjacentCluExists && absDelta > 1.0) return 'boundary_creep'
  return 'unknown'
}

// ===== GCS Summary =====

export function gcsSummary(enrollments: GcsEnrollment[]) {
  let cc340 = 0
  let rt345 = 0
  let nt329 = 0

  for (const e of enrollments) {
    cc340 += e.cc340_acres || 0
    rt345 += e.rt345_acres || 0
    nt329 += e.nt329_acres || 0
  }

  return {
    cc340Acres: round2(cc340),
    rt345Acres: round2(rt345),
    nt329Acres: round2(nt329),
    totalEnrollments: enrollments.length,
  }
}
