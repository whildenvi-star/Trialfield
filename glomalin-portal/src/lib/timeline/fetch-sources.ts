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
import { resolveFieldEnterpriseIds } from '@/app/api/mobile/_lib/cert-bridge'
import { createClient } from '@/lib/supabase/server'
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

  // Machinery passes — confirmed entries carry their real as-applied date,
  // unconfirmed entries stay undated/planned and sort to the bottom.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const machinery: any[] = Array.isArray(field.machinery) ? field.machinery : []
  for (const m of machinery) {
    if (m.passStatus === 'disregarded') continue
    const id = m.id ?? `budget-pass-${crypto.randomUUID()}`
    const confirmed = m.passStatus === 'confirmed'
    const date: string | null = confirmed && m.confirmedDate ? m.confirmedDate : null
    const bySuffix = confirmed && m.confirmedBy ? ` — ${m.confirmedBy}` : ''
    entries.push({
      id,
      source: 'budget',
      date,
      sortDate: date ?? '9999-12-31',
      activityType: m.implementName ?? 'Field Pass',
      summary: `[Budget] ${m.implementName ?? 'Field Pass'}${bySuffix}`,
      detail: {
        implementName: m.implementName,
        acres: field.plantedAcres ?? field.acres,
        confirmedBy: m.confirmedBy ?? null,
        statusNote: m.statusNote ?? null,
      },
      status: confirmed ? 'confirmed' : 'planned',
      pairedWith: null,
      sourceLink: null,
    })
  }

  // Input applications — same treatment, plus invoice evidence for the audit view
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inputs: any[] = Array.isArray(field.inputs) ? field.inputs : []
  for (const inp of inputs) {
    if (!inp.productName) continue
    const confirmed = inp.passStatus === 'confirmed'
    const date: string | null = confirmed && inp.confirmedDate ? inp.confirmedDate : null
    const rateStr = inp.quantity ? ` ${inp.quantity} ${inp.unit ?? 'per acre'}` : ''
    const bySuffix = confirmed && inp.confirmedBy ? ` — ${inp.confirmedBy}` : ''
    entries.push({
      id: inp.id ?? `budget-input-${crypto.randomUUID()}`,
      source: 'budget',
      date,
      sortDate: date ?? '9999-12-31',
      activityType: 'Input Application',
      summary: `[Budget] ${inp.productName}${rateStr}${bySuffix}`,
      detail: {
        productName: inp.productName,
        quantity: inp.quantity,
        unit: inp.unit,
        acres: field.plantedAcres ?? field.acres,
        confirmedBy: inp.confirmedBy ?? null,
        actualQuantity: inp.actualQuantity ?? null,
        statusNote: inp.statusNote ?? null,
        invoiceNumber: inp.invoiceNumber ?? null,
        invoiceVendor: inp.invoiceVendor ?? null,
        invoiceDate: inp.invoiceDate ?? null,
        invoiceCostTotal: inp.invoiceCostTotal ?? null,
      },
      status: confirmed ? 'confirmed' : 'planned',
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
  // Split fields have one enterprise per crop — the timeline shows them all.
  const fieldEnterpriseIds = await resolveFieldEnterpriseIds(registryFieldId)
  if (fieldEnterpriseIds.length === 0) {
    throw new Error(`No organic-cert enterprise found for registry field ${registryFieldId}`)
  }

  const entries: TimelineEntry[] = []
  for (const fieldEnterpriseId of fieldEnterpriseIds) {
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

    for (const op of ops) {
      const rawDate: string | null = op.operationDate
        ? new Date(op.operationDate).toISOString().split('T')[0]
        : null
      const operatorStr = op.operator?.name ? ` — ${op.operator.name}` : ''
      entries.push({
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
          crop: enterprise.crop ?? null,
          enterpriseLabel: enterprise.label ?? null,
        },
        status: op.passStatus === 'PLANNED' ? 'planned' : 'confirmed',
        pairedWith: op.budgetImplementId ?? null,
        sourceLink: '/app/org-cert',
      })
    }
  }

  return entries
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
  // Step 1: Resolve to an organic-cert field enterprise to find the cert field ID
  // (any enterprise works — they all share the same cert field)
  let fieldEnterpriseId: string
  try {
    const ids = await resolveFieldEnterpriseIds(registryFieldId)
    if (ids.length === 0) return []
    fieldEnterpriseId = ids[0]
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
// Field observations source
// ────────────────────────────────────────────────────────────────────────────

export async function fetchObservationActivities(
  registryFieldId: string
): Promise<TimelineEntry[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('field_observations')
    .select('id, note, photo_path, submitted_by, created_at')
    .eq('registry_field_id', registryFieldId)

  if (error) throw new Error(`field_observations query failed: ${error.message}`)
  if (!data || data.length === 0) return []

  return data.map((row): TimelineEntry => {
    const rawDate: string | null = row.created_at
      ? new Date(row.created_at).toISOString().split('T')[0]
      : null
    const noteText: string = row.note ?? ''
    const truncated = noteText.length > 60 ? noteText.slice(0, 60) + '…' : noteText
    const summaryBody = truncated || 'Photo'
    return {
      id: `observation-${row.id}`,
      source: 'observation',
      date: rawDate,
      sortDate: rawDate ?? '9999-12-31',
      activityType: 'Field Observation',
      summary: `[Observation] ${summaryBody}`,
      detail: {
        notes: row.note ?? null,
        photo_path: row.photo_path ?? null,
        submitted_by: row.submitted_by ?? null,
      },
      status: 'completed',
      pairedWith: null,
      sourceLink: '/app/observations',
    }
  })
}

// ────────────────────────────────────────────────────────────────────────────
// Insurance claims source
// ────────────────────────────────────────────────────────────────────────────

export async function fetchClaimActivities(
  registryFieldId: string
): Promise<TimelineEntry[]> {
  const supabase = await createClient()

  const { data: boundary } = await supabase
    .from('field_boundaries')
    .select('name')
    .eq('registry_field_id', registryFieldId)
    .maybeSingle()

  if (!boundary) return []

  const boundaryName: string = boundary.name ?? ''

  const { data: policies, error: policiesError } = await supabase
    .from('insurance_policies')
    .select('id')
    .eq('farm_name', boundaryName)

  if (policiesError) throw new Error(`insurance_policies query failed: ${policiesError.message}`)
  if (!policies || policies.length === 0) return []

  const policyIds = policies.map((p) => p.id)

  const { data: claims, error: claimsError } = await supabase
    .from('claims')
    .select('id, stage, crop, date_of_loss, description, deadline_at')
    .in('policy_id', policyIds)

  if (claimsError) throw new Error(`claims query failed: ${claimsError.message}`)
  if (!claims || claims.length === 0) return []

  return claims.map((row): TimelineEntry => {
    const rawDate: string | null = row.date_of_loss
      ? new Date(row.date_of_loss).toISOString().split('T')[0]
      : null
    const descPart = row.description
      ? ' · ' + (row.description as string).slice(0, 40)
      : ''
    return {
      id: `claim-${row.id}`,
      source: 'claim',
      date: rawDate,
      sortDate: rawDate ?? '9999-12-31',
      activityType: 'Insurance Claim',
      summary: `[Claim] ${row.crop ?? 'Crop'} — ${row.stage}${descPart}`,
      detail: {
        stage: row.stage ?? null,
        crop: row.crop ?? null,
        deadline_at: row.deadline_at ?? null,
      },
      status: row.stage === 'closed' ? 'completed' : 'confirmed',
      pairedWith: null,
      sourceLink: '/app/compliance?tab=claims',
    }
  })
}

// ────────────────────────────────────────────────────────────────────────────
// Merge aggregator
// ────────────────────────────────────────────────────────────────────────────

/** Source priority for same-date tie-breaking (lower index = higher priority). */
const SOURCE_PRIORITY: TimelineSource[] = ['cert', 'fieldops', 'budget', 'grain', 'observation', 'claim']

/**
 * Merge results from Promise.allSettled across all sources into a unified
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
  let allEntries: TimelineEntry[] = []
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

  // Collapse budget↔cert pairs into a single row: a cert entry whose
  // budgetImplementId (pairedWith) matches a budget machinery entry IS that
  // budget pass, confirmed — showing both would double-count the operation.
  // The cert row wins (it carries date/operator); it keeps a budget provenance
  // marker via pairedWith and inherits the implement name for display.
  const budgetById = new Map<string, TimelineEntry>()
  for (const entry of allEntries) {
    if (entry.source === 'budget') {
      budgetById.set(entry.id, entry)
    }
  }

  const consumedBudgetIds = new Set<string>()
  for (const entry of allEntries) {
    if (entry.source !== 'cert' || !entry.pairedWith) continue
    const budgetEntry = budgetById.get(entry.pairedWith)
    if (!budgetEntry) continue
    consumedBudgetIds.add(budgetEntry.id)
    const implementName = budgetEntry.detail['implementName']
    if (implementName && !entry.detail['implementName']) {
      entry.detail['implementName'] = implementName
      entry.summary = `[Organic Cert] ${implementName}${
        entry.detail['operator'] ? ` — ${entry.detail['operator']}` : ''
      }`
    }
  }

  allEntries = allEntries.filter(
    (e) => !(e.source === 'budget' && consumedBudgetIds.has(e.id))
  )

  // Sort by sortDate ascending, then by source priority for same date
  allEntries.sort((a, b) => {
    if (a.sortDate < b.sortDate) return -1
    if (a.sortDate > b.sortDate) return 1
    // Same date — sort by source priority
    const aPriority = SOURCE_PRIORITY.indexOf(a.source)
    const bPriority = SOURCE_PRIORITY.indexOf(b.source)
    return aPriority - bPriority
  })

  return { entries: allEntries, warnings }
}
