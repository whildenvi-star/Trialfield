/**
 * Season rail builder — merges an enterprise's field operations, material
 * applications, seed usages, fertility events, and harvest events into one
 * chronological list of RailItems for the field-history views.
 *
 * Confirmed/dated items sort by date ascending (the season progression);
 * planned/undated items are separated out so the UI can pin them in a dimmed
 * "planned / not yet confirmed" strip.
 */

import { classifyStage, STAGE_ORDER, type Stage } from './stage-classifier'

export type Provenance = 'Budget' | 'Mobile' | 'TC Log' | 'FieldOps' | 'Manual' | 'Imported'

export interface RailItem {
  id: string
  kind: 'operation' | 'application' | 'seed' | 'fertility' | 'harvest'
  date: string | null // ISO date; null when planned/undated
  stage: Stage
  text: string // primary label: implement / product / variety / yield
  detail: string | null // secondary: rate, qty, acres
  by: string | null // operator / applicator name
  provenance: Provenance
  confirmed: boolean
  invoice: string | null // "Inv #8001874, Delong, 2026-04-22" when present
  notes: string | null
}

// ── input record shapes (matching /api/field-history/[fieldId]) ─────────────

export interface RailFieldOp {
  id: string
  type: string
  operationDate: string | null
  description: string | null
  dataSource: string
  passStatus: string
  plannedSource?: string | null
  passNumber?: number | null
  notes?: string | null
  operator?: { name: string } | null
}

export interface RailMaterialUsage {
  id: string
  applicationDate: string
  rate: number
  rateUnit: string
  acres: number
  actualRate?: number | null
  actualTotalCost?: number | null
  applicator?: string | null
  confirmedDate?: string | null
  confirmedBy?: string | null
  dataSource: string
  notes?: string | null
  material: { name: string; nopStatus?: string | null; omriListed?: boolean | null }
}

export interface RailSeedUsage {
  id: string
  plantingDate: string | null
  rate: number
  rateUnit: string
  acres: number
  dataSource: string
  notes?: string | null
  seedLot: { variety: string; brand?: string | null; isOrganic?: boolean | null; lotNumber?: string | null }
}

export interface RailFertilityEvent {
  id: string
  type: string
  applicationDate: string
  quantity: number
  quantityUnit: string
  notes: string | null
}

export interface RailHarvestEvent {
  id: string
  harvestDate: string
  yieldPerAcre: number | null
  yieldUnit: string | null
  acresHarvested: number
  dataSource: string
  notes: string | null
}

export interface RailEnterprise {
  fieldOperations: RailFieldOp[]
  materialUsages?: RailMaterialUsage[]
  seedUsages?: RailSeedUsage[]
  fertilityEvents: RailFertilityEvent[]
  harvestEvents: RailHarvestEvent[]
}

// ── helpers ─────────────────────────────────────────────────────────────────

function isoDay(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    return new Date(value).toISOString().split('T')[0]
  } catch {
    return null
  }
}

function opProvenance(op: RailFieldOp): Provenance {
  if (op.dataSource === 'IMPORTED') return 'Imported'
  if (op.plannedSource === 'mobile-logger') return 'Mobile'
  if (op.plannedSource === 'field-ops-tc') return 'TC Log'
  if (op.plannedSource === 'budget-import') return 'Budget'
  if (op.dataSource === 'SYNCED') return (op.notes ?? '').includes('FieldOps') ? 'FieldOps' : 'Budget'
  return 'Manual'
}

function usageProvenance(dataSource: string): Provenance {
  if (dataSource === 'IMPORTED') return 'Imported'
  if (dataSource === 'SYNCED') return 'Budget'
  return 'Manual'
}

/** Extract the invoice provenance segment sync-macro embeds in notes. */
function extractInvoice(notes: string | null | undefined): string | null {
  if (!notes) return null
  const match = notes.match(/Inv #[^—]*/)
  return match ? match[0].trim() : null
}

const FERTILITY_LABELS: Record<string, string> = {
  MANURE: 'Manure/compost',
  COMPOST: 'Compost',
  GREEN_MANURE: 'Green manure',
  MINERAL: 'Minerals',
  FOLIAR: 'Foliar',
  PELLET: 'Pellets',
  INOCULANT: 'Inoculant',
  OTHER: 'Fertility',
}

// ── builder ─────────────────────────────────────────────────────────────────

export function buildSeasonRail(ent: RailEnterprise): { confirmed: RailItem[]; planned: RailItem[] } {
  const items: RailItem[] = []

  for (const op of ent.fieldOperations) {
    const label = op.description || op.type.charAt(0) + op.type.slice(1).toLowerCase()
    items.push({
      id: `op-${op.id}`,
      kind: 'operation',
      date: isoDay(op.operationDate),
      stage: classifyStage(op.description || op.type),
      text: label,
      detail: op.passNumber && op.passNumber > 1 ? `pass ${op.passNumber}` : null,
      by: op.operator?.name ?? null,
      provenance: opProvenance(op),
      confirmed: op.passStatus === 'CONFIRMED',
      invoice: null,
      notes: op.notes ?? null,
    })
  }

  for (const mu of ent.materialUsages ?? []) {
    const rate = mu.actualRate ?? mu.rate
    // A SYNCED application is only "as applied" once confirmation metadata arrived
    // from farm-budget; MANUAL/IMPORTED entries are as-applied by definition.
    const confirmed = mu.dataSource === 'SYNCED' ? mu.confirmedDate != null || mu.applicator != null : true
    items.push({
      id: `mu-${mu.id}`,
      kind: 'application',
      date: confirmed ? isoDay(mu.confirmedDate ?? mu.applicationDate) : null,
      stage: classifyStage(mu.material.name),
      text: mu.material.name,
      detail: `${rate} ${mu.rateUnit}${mu.actualRate != null && mu.actualRate !== mu.rate ? ` (plan ${mu.rate})` : ''}`,
      by: mu.applicator ?? mu.confirmedBy ?? null,
      provenance: usageProvenance(mu.dataSource),
      confirmed,
      invoice: extractInvoice(mu.notes),
      notes: mu.notes ?? null,
    })
  }

  for (const su of ent.seedUsages ?? []) {
    items.push({
      id: `su-${su.id}`,
      kind: 'seed',
      date: isoDay(su.plantingDate),
      stage: 'Planting',
      text: su.seedLot.variety + (su.seedLot.brand ? ` (${su.seedLot.brand})` : ''),
      detail: `${su.rate} ${su.rateUnit}`,
      by: null,
      provenance: usageProvenance(su.dataSource),
      confirmed: true,
      invoice: null,
      notes: su.notes ?? null,
    })
  }

  for (const fe of ent.fertilityEvents) {
    const label = FERTILITY_LABELS[fe.type] ?? fe.type
    items.push({
      id: `fe-${fe.id}`,
      kind: 'fertility',
      date: isoDay(fe.applicationDate),
      stage: 'Fertility',
      text: fe.notes && fe.quantityUnit === 'imported' ? fe.notes : label,
      detail: fe.quantityUnit !== 'imported' && fe.quantity ? `${fe.quantity} ${fe.quantityUnit}` : null,
      by: null,
      provenance: fe.quantityUnit === 'imported' ? 'Imported' : 'Manual',
      confirmed: true,
      invoice: null,
      notes: fe.quantityUnit === 'imported' ? null : fe.notes,
    })
  }

  for (const he of ent.harvestEvents) {
    items.push({
      id: `he-${he.id}`,
      kind: 'harvest',
      date: isoDay(he.harvestDate),
      stage: 'Harvest',
      text:
        he.yieldPerAcre != null
          ? `Harvest · ${he.yieldPerAcre.toFixed(1)} ${he.yieldUnit ?? 'unit'}/ac`
          : 'Harvest',
      detail: he.acresHarvested ? `${he.acresHarvested.toFixed(1)} ac` : null,
      by: null,
      provenance: usageProvenance(he.dataSource),
      confirmed: true,
      invoice: null,
      notes: he.notes,
    })
  }

  const confirmed = items
    .filter((i) => i.confirmed && i.date)
    .sort((a, b) => (a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : 0))

  // Confirmed-but-undated (e.g. legacy imports) ride at the top of the rail in
  // stage order rather than being hidden — an audit record must not drop them.
  const undatedConfirmed = items
    .filter((i) => i.confirmed && !i.date)
    .sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage))

  const planned = items
    .filter((i) => !i.confirmed)
    .sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage))

  return { confirmed: [...undatedConfirmed, ...confirmed], planned }
}
