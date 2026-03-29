/**
 * Per-source fetch functions and mergeTimeline aggregator for the Field Activity Timeline.
 *
 * Each fetch function converts source-specific data into the unified TimelineEntry shape.
 * Errors propagate to the caller (which uses Promise.allSettled to handle partial failures).
 */

import {
  fetchBudgetService,
  fetchCertService,
  fetchGrainService,
} from '@/app/api/mobile/_lib/proxy'
import { resolveFieldEnterpriseId } from '@/app/api/mobile/_lib/cert-bridge'
import type { TimelineEntry, TimelineSource } from './types'

// ────────────────────────────────────────────────────────────────────────────
// Budget source
// ────────────────────────────────────────────────────────────────────────────

/**
 * Fetch planned machinery passes and input applications from farm-budget
 * for the given registry field ID.
 *
 * Returns [] when no budget field matches (field not in budget this season).
 * Throws on network/service failure (caller uses allSettled).
 */
export async function fetchBudgetActivities(
  registryFieldId: string
): Promise<TimelineEntry[]> {
  const res = await fetchBudgetService('/api/fields')
  if (!res.ok) {
    throw new Error(`farm-budget fields unavailable: ${res.status}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fields: any[] = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const field = Array.isArray(fields)
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fields.find((f: any) => f.registryFieldId === registryFieldId)
    : null

  if (!field) return []

  const entries: TimelineEntry[] = []

  // Machinery passes → planned pass entries
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const machinery: any[] = Array.isArray(field.machinery) ? field.machinery : []
  for (const m of machinery) {
    const id = m.id ?? `budget-pass-${crypto.randomUUID()}`
    entries.push({
      id,
      source: 'budget',
      date: null,
      sortDate: '9999-12-31',
      activityType: m.implementName ?? 'Field Pass',
      summary: `[Budget] ${m.implementName ?? 'Field Pass'}`,
      detail: {
        implementName: m.implementName,
        acres: field.plantedAcres ?? field.acres,
      },
      status: 'planned',
      pairedWith: null,
      sourceLink: null,
    })
  }

  // Input applications → separate planned entries with date null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inputs: any[] = Array.isArray(field.inputs) ? field.inputs : []
  for (const inp of inputs) {
    if (!inp.productName) continue
    const rateStr = inp.quantity ? ` ${inp.quantity} ${inp.unit ?? 'per acre'}` : ''
    entries.push({
      id: inp.id ?? `budget-input-${crypto.randomUUID()}`,
      source: 'budget',
      date: null,
      sortDate: '9999-12-31',
      activityType: 'Input Application',
      summary: `[Budget] ${inp.productName}${rateStr}`,
      detail: {
        productName: inp.productName,
        quantity: inp.quantity,
        unit: inp.unit,
        acres: field.plantedAcres ?? field.acres,
      },
      status: 'planned',
      pairedWith: null,
      sourceLink: null,
    })
  }

  return entries
}

// ────────────────────────────────────────────────────────────────────────────
// Organic-cert source
// ────────────────────────────────────────────────────────────────────────────

/**
 * Fetch confirmed field operations from organic-cert for the given registry field ID.
 *
 * Throws when organic-cert is unreachable or no matching field enterprise exists
 * (caller uses allSettled to handle graceful degradation).
 */
export async function fetchCertActivities(
  registryFieldId: string
): Promise<TimelineEntry[]> {
  const fieldEnterpriseId = await resolveFieldEnterpriseId(registryFieldId)

  const res = await fetchCertService(`/api/field-enterprises/${fieldEnterpriseId}`)
  if (!res.ok) {
    throw new Error(`organic-cert field-enterprise unavailable: ${res.status}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enterprise: any = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ops: any[] = Array.isArray(enterprise.fieldOperations)
    ? enterprise.fieldOperations
    : []

  return ops.map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (op: any): TimelineEntry => {
      const rawDate: string | null = op.operationDate
        ? new Date(op.operationDate).toISOString().split('T')[0]
        : null
      const operatorStr = op.operator?.name ? ` — ${op.operator.name}` : ''
      return {
        id: `cert-${op.id}`,
        source: 'cert',
        date: rawDate,
        sortDate: rawDate ?? '9999-12-31',
        activityType: op.type ?? 'Field Operation',
        summary: `[Organic Cert] ${op.type ?? 'Operation'}${operatorStr}`,
        detail: {
          operator: op.operator?.name ?? null,
          acresWorked: op.acresWorked ?? null,
          equipment: op.equipment ?? null,
          passStatus: op.passStatus ?? null,
          description: op.description ?? null,
          costPerAcre: op.costPerAcre ?? null,
        },
        status: 'confirmed',
        pairedWith: op.budgetImplementId ?? null,
        sourceLink: '/app/org-cert',
      }
    }
  )
}

// ────────────────────────────────────────────────────────────────────────────
// FieldOps (CaseIH) source
// ────────────────────────────────────────────────────────────────────────────

/**
 * Fetch machine-data operations from organic-cert's SyncedOperations
 * (CaseIH FieldOps sync) for the given registry field ID.
 *
 * Returns [] when no FieldOps sync is configured for this field.
 * Throws on service failure.
 */
export async function fetchFieldOpsActivities(
  registryFieldId: string
): Promise<TimelineEntry[]> {
  // Step 1: Resolve to organic-cert field enterprise to find the cert field ID
  let fieldEnterpriseId: string
  try {
    fieldEnterpriseId = await resolveFieldEnterpriseId(registryFieldId)
  } catch {
    // If the field has no cert enterprise, it has no FieldOps data either
    return []
  }

  // Step 2: Get field enterprise to find the cert field ID
  const enterpriseRes = await fetchCertService(`/api/field-enterprises/${fieldEnterpriseId}`)
  if (!enterpriseRes.ok) {
    throw new Error(`organic-cert field-enterprise unavailable: ${enterpriseRes.status}`)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enterprise: any = await enterpriseRes.json()
  const certFieldId: string | null = enterprise.fieldId ?? null

  if (!certFieldId) return []

  // Step 3: Fetch SyncedOperations filtered by the cert field
  // Try the admin/staged-ops endpoint with a filter; fall back to fetching all
  const stagedRes = await fetchCertService(
    `/api/admin/staged-ops?fieldId=${encodeURIComponent(certFieldId)}`
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let syncedOps: any[] = []

  if (stagedRes.ok) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await stagedRes.json()
    syncedOps = Array.isArray(data) ? data : Array.isArray(data?.ops) ? data.ops : []
  } else if (stagedRes.status === 404 || stagedRes.status === 405) {
    // Endpoint may not exist — silently return empty (no FieldOps configured)
    return []
  } else {
    throw new Error(`organic-cert staged-ops unavailable: ${stagedRes.status}`)
  }

  // Filter to this cert field if the endpoint doesn't support the filter param
  const fieldOps = syncedOps.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (op: any) => !op.mappedFieldId || op.mappedFieldId === certFieldId || op.fieldId === certFieldId
  )

  return fieldOps.map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (op: any): TimelineEntry => {
      const rawDate: string | null = op.operationDate
        ? new Date(op.operationDate).toISOString().split('T')[0]
        : null
      const acresStr = op.acresWorked ? ` ${op.acresWorked} ac` : ''
      return {
        id: `fieldops-${op.id}`,
        source: 'fieldops',
        date: rawDate,
        sortDate: rawDate ?? '9999-12-31',
        activityType: op.rawOpType ?? op.type ?? 'Machine Operation',
        summary: `[FieldOps] ${op.rawOpType ?? op.type ?? 'Operation'}${acresStr}`,
        detail: {
          caseIHFieldName: op.caseIHFieldName ?? null,
          products: op.products ?? null,
          acresWorked: op.acresWorked ?? null,
          rawPayload: op.rawPayload
            ? JSON.stringify(op.rawPayload).slice(0, 200)
            : null,
        },
        status: 'completed',
        pairedWith: null,
        sourceLink: null,
      }
    }
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Grain-tickets source
// ────────────────────────────────────────────────────────────────────────────

/**
 * Fetch grain delivery tickets from grain-tickets for the given registry field ID
 * and crop year.
 *
 * Returns [] when no farm in grain-tickets is linked to this registry field.
 * Throws on service failure.
 */
export async function fetchGrainActivities(
  registryFieldId: string,
  cropYear: number
): Promise<TimelineEntry[]> {
  const farmsRes = await fetchGrainService('/api/farms')
  if (!farmsRes.ok) {
    throw new Error(`grain-tickets farms unavailable: ${farmsRes.status}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const farms: any[] = await farmsRes.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const farm = Array.isArray(farms)
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      farms.find((f: any) => f.registryId === registryFieldId)
    : null

  if (!farm) return []

  const ticketsRes = await fetchGrainService(`/api/tickets?cropYear=${cropYear}`)
  if (!ticketsRes.ok) {
    throw new Error(`grain-tickets tickets unavailable: ${ticketsRes.status}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allTickets: any[] = await ticketsRes.json()
  const farmName: string = farm.name ?? ''
  const tickets = Array.isArray(allTickets)
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      allTickets.filter((t: any) => t.farmName === farmName || t.farm === farmName)
    : []

  return tickets.map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ticket: any): TimelineEntry => {
      const rawDate: string | null = ticket.date
        ? new Date(ticket.date).toISOString().split('T')[0]
        : null
      const testWeight: number = ticket.testWeight ?? 60
      const netWeight: number = ticket.netWeight ?? ticket.net ?? 0
      const bushels = testWeight > 0 ? Math.round(netWeight / testWeight) : 0
      const dest: string = ticket.destination ?? ticket.buyer ?? 'Unknown'
      const crop: string = ticket.crop ?? ticket.commodity ?? 'Grain'

      return {
        id: `grain-${ticket.id ?? ticket.ticketNo ?? crypto.randomUUID()}`,
        source: 'grain',
        date: rawDate,
        sortDate: rawDate ?? '9999-12-31',
        activityType: 'Delivery',
        summary: `[Grain] ${crop} - ${bushels} BU to ${dest}`,
        detail: {
          ticketNo: ticket.ticketNo ?? ticket.id ?? null,
          netWeight,
          moisture: ticket.moisture ?? null,
          crop,
          buyer: ticket.buyer ?? null,
          hbtBinNo: ticket.hbtBinNo ?? null,
          destination: dest,
        },
        status: 'completed',
        pairedWith: null,
        sourceLink: '/app/grain-tickets',
      }
    }
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Merge aggregator
// ────────────────────────────────────────────────────────────────────────────

/** Source priority for same-date tie-breaking (lower index = higher priority). */
const SOURCE_PRIORITY: TimelineSource[] = ['cert', 'fieldops', 'budget', 'grain']

/**
 * Merge results from Promise.allSettled across all 4 sources into a unified
 * sorted entry list with a warnings array for failed sources.
 *
 * - Fulfilled results contribute their entries.
 * - Rejected results add the source name to warnings.
 * - Entries are sorted by sortDate ascending, then by source priority for ties.
 * - Budget entries are paired with matching cert entries via pairedWith IDs.
 */
export function mergeTimeline(
  sources: PromiseSettledResult<TimelineEntry[]>[],
  sourceNames: TimelineSource[]
): { entries: TimelineEntry[]; warnings: string[] } {
  const allEntries: TimelineEntry[] = []
  const warnings: string[] = []

  for (let i = 0; i < sources.length; i++) {
    const result = sources[i]
    const name = sourceNames[i]
    if (result.status === 'fulfilled') {
      allEntries.push(...result.value)
    } else {
      warnings.push(name)
    }
  }

  // Sort by sortDate ascending, then by source priority for same date
  allEntries.sort((a, b) => {
    if (a.sortDate < b.sortDate) return -1
    if (a.sortDate > b.sortDate) return 1
    // Same date — sort by source priority
    const aPriority = SOURCE_PRIORITY.indexOf(a.source)
    const bPriority = SOURCE_PRIORITY.indexOf(b.source)
    return aPriority - bPriority
  })

  // Pair budget entries with matching cert entries:
  // For each cert entry that has a pairedWith ID, find the budget entry with that ID
  // and set the budget entry's pairedWith to point back to the cert entry.
  const certEntries = allEntries.filter((e) => e.source === 'cert' && e.pairedWith)
  const budgetById = new Map<string, TimelineEntry>()
  for (const entry of allEntries) {
    if (entry.source === 'budget') {
      budgetById.set(entry.id, entry)
    }
  }

  for (const certEntry of certEntries) {
    if (certEntry.pairedWith) {
      const budgetEntry = budgetById.get(certEntry.pairedWith)
      if (budgetEntry) {
        budgetEntry.pairedWith = certEntry.id
      }
    }
  }

  return { entries: allEntries, warnings }
}
