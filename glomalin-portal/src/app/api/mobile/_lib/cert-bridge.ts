import { fetchBudgetService, fetchCertService } from './proxy'

/**
 * Mapping from mobile-friendly operation type names to organic-cert FieldOpType enum values.
 * Exported for use by Plan 02 UI routes as well.
 */
export const OP_TYPE_MAP: Record<string, string> = {
  Tillage: 'TILLAGE',
  Planting: 'PLANTING',
  Herbicide: 'SPRAYING',
  Fertilizer: 'SPRAYING',
  Harvest: 'HARVEST',
  Scouting: 'OTHER',
  Other: 'OTHER',
  // Direct organic-cert enum values pass through unchanged
  TILLAGE: 'TILLAGE',
  PLANTING: 'PLANTING',
  CULTIVATION: 'CULTIVATION',
  MOWING: 'MOWING',
  IRRIGATION: 'IRRIGATION',
  FLAMING: 'FLAMING',
  SPRAYING: 'SPRAYING',
  HARVEST: 'HARVEST',
  OTHER: 'OTHER',
}

/**
 * Resolve the organic-cert fieldEnterpriseId for a mobile fieldId.
 *
 * The mobile app passes FARM-BUDGET field ids (e.g. "fld_0642"), which live in a
 * different namespace than farm-registry ids (e.g. "fld_009") — and organic-cert's
 * Field.registryId holds REGISTRY ids. So resolution goes:
 *
 * 1. GET farm-budget /api/fields/{fieldId} — translate budget id → registryFieldId,
 *    and capture the budget field's crop (budget fields are per-crop, so the crop
 *    disambiguates split fields that share one registry field).
 *    If the budget lookup misses, the input is assumed to already be a registry id.
 * 2. GET organic-cert /api/fields — find the field whose registryId matches.
 * 3. GET organic-cert /api/field-enterprises — filter to that field + current crop
 *    year, then by opts.enterpriseId / crop when more than one matches.
 *
 * Throws with a descriptive message (listing the candidate enterprises when
 * ambiguous) if resolution fails — never silently picks the wrong crop.
 */
export async function resolveFieldEnterpriseId(
  fieldId: string,
  opts?: { enterpriseId?: string | null; crop?: string | null }
): Promise<string> {
  const currentYear = new Date().getFullYear()

  // Step 1: translate budget field id → registry id (+ crop for split-field disambiguation)
  let registryFieldId = fieldId
  let budgetCrop: string | null = opts?.crop ?? null
  try {
    const budgetRes = await fetchBudgetService(`/api/fields/${fieldId}`)
    if (budgetRes.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const budgetField: any = await budgetRes.json()
      if (budgetField?.registryFieldId) registryFieldId = budgetField.registryFieldId
      if (!budgetCrop && budgetField?.crop) budgetCrop = budgetField.crop
    }
  } catch {
    // farm-budget unavailable — fall through and treat fieldId as a registry id
  }

  // Step 2: Find the organic-cert field by registryId
  const fieldsRes = await fetchCertService('/api/fields')
  if (!fieldsRes.ok) {
    throw new Error(`organic-cert fields unavailable: ${fieldsRes.status}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fields: any[] = await fieldsRes.json()
  const certField = fields.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (f: any) => f.registryId === registryFieldId || f.registryId === fieldId
  )

  if (!certField) {
    throw new Error(
      `No organic-cert field found with registryId "${registryFieldId}" (from fieldId "${fieldId}"). ` +
        `Ensure farm-registry sync has been run.`
    )
  }

  // Step 3: Find the current-year FieldEnterprise for this field
  const enterprisesRes = await fetchCertService(`/api/field-enterprises`)
  if (!enterprisesRes.ok) {
    throw new Error(`organic-cert field-enterprises unavailable: ${enterprisesRes.status}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allEnterprises: any[] = await enterprisesRes.json()
  let matching = allEnterprises.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: any) => e.fieldId === certField.id && e.cropYear === currentYear
  )

  if (matching.length === 0) {
    throw new Error(
      `No FieldEnterprise found for field "${certField.name}" in crop year ${currentYear}. ` +
        `Ensure field enterprises have been synced from farm-budget.`
    )
  }

  // Explicit enterprise override wins — but must belong to this field/year
  if (opts?.enterpriseId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const explicit = matching.find((e: any) => e.id === opts.enterpriseId)
    if (!explicit) {
      throw new Error(
        `Enterprise "${opts.enterpriseId}" does not belong to field "${certField.name}" in crop year ${currentYear}.`
      )
    }
    return explicit.id
  }

  // Split fields: narrow by crop (cert enterprise crop is the budget crop string verbatim)
  if (matching.length > 1 && budgetCrop) {
    const cropLower = budgetCrop.toLowerCase()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byCrop = matching.filter((e: any) => (e.crop || '').toLowerCase() === cropLower)
    if (byCrop.length > 0) matching = byCrop
  }

  if (matching.length > 1) {
    const options = matching
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((e: any) => `${e.crop}${e.label ? ` · ${e.label}` : ''} (${e.id})`)
      .join('; ')
    throw new Error(
      `Field "${certField.name}" has ${matching.length} enterprises for ${currentYear}: ${options}. ` +
        `Pass fieldEnterpriseId to disambiguate.`
    )
  }

  return matching[0].id
}

/**
 * Resolve ALL organic-cert fieldEnterpriseIds for a registry field in the given
 * crop year (defaults to current). Read paths like the field timeline want every
 * enterprise on a split field, not a single disambiguated one — writes should
 * keep using resolveFieldEnterpriseId.
 *
 * Returns [] when the field or year has no enterprises; throws only when
 * organic-cert itself is unreachable.
 */
export async function resolveFieldEnterpriseIds(
  registryFieldId: string,
  cropYear?: number
): Promise<string[]> {
  const year = cropYear ?? new Date().getFullYear()

  const fieldsRes = await fetchCertService('/api/fields')
  if (!fieldsRes.ok) {
    throw new Error(`organic-cert fields unavailable: ${fieldsRes.status}`)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fields: any[] = await fieldsRes.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const certField = fields.find((f: any) => f.registryId === registryFieldId)
  if (!certField) return []

  const enterprisesRes = await fetchCertService(`/api/field-enterprises`)
  if (!enterprisesRes.ok) {
    throw new Error(`organic-cert field-enterprises unavailable: ${enterprisesRes.status}`)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allEnterprises: any[] = await enterprisesRes.json()
  return allEnterprises
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((e: any) => e.fieldId === certField.id && e.cropYear === year)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((e: any) => e.id)
}
