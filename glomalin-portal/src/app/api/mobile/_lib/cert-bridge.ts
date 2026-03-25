import { fetchCertService } from './proxy'

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
 * Resolve the organic-cert fieldEnterpriseId for a given farm-budget registryId (fieldId).
 *
 * Steps:
 * 1. GET /api/fields from organic-cert — find the field whose registryId matches fieldId
 * 2. GET /api/field-enterprises?fieldId=... filtered to current crop year
 * 3. Return the first matching fieldEnterpriseId
 *
 * Throws with a descriptive message if not found.
 */
export async function resolveFieldEnterpriseId(registryFieldId: string): Promise<string> {
  const currentYear = new Date().getFullYear()

  // Step 1: Find the organic-cert field by registryId
  const fieldsRes = await fetchCertService('/api/fields')
  if (!fieldsRes.ok) {
    throw new Error(`organic-cert fields unavailable: ${fieldsRes.status}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fields: any[] = await fieldsRes.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const certField = fields.find((f: any) => f.registryId === registryFieldId)

  if (!certField) {
    throw new Error(
      `No organic-cert field found with registryId "${registryFieldId}". ` +
        `Ensure farm-registry sync has been run.`
    )
  }

  // Step 2: Find the current-year FieldEnterprise for this field
  const enterprisesRes = await fetchCertService(`/api/field-enterprises`)
  if (!enterprisesRes.ok) {
    throw new Error(`organic-cert field-enterprises unavailable: ${enterprisesRes.status}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allEnterprises: any[] = await enterprisesRes.json()
  const matching = allEnterprises.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: any) => e.fieldId === certField.id && e.cropYear === currentYear
  )

  if (matching.length === 0) {
    throw new Error(
      `No FieldEnterprise found for field "${certField.name}" in crop year ${currentYear}. ` +
        `Ensure field enterprises have been synced from farm-budget.`
    )
  }

  // Return the first enterprise — for split fields with multiple enterprises,
  // the confirm endpoint should receive a specific fieldEnterpriseId override
  return matching[0].id
}
