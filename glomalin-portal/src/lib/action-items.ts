/**
 * Types and constants for the actionable dashboard action-items endpoint.
 */

export type Severity = 'warning' | 'info'

export interface ActionItem {
  id: string
  severity: Severity
  summary: string
  count: number
  link: string
  age?: string
}

export interface ActionItemGroup {
  module: string
  label: string
  badge: string
  items: ActionItem[]
  offline: boolean
}

export type ActionItemsResponse = {
  groups: ActionItemGroup[]
  totalCount: number
  fetchedAt: number
}

/** Module display metadata keyed by module identifier. */
export const MODULE_SOURCES: Record<string, { label: string; badge: string }> = {
  'fsa-578': { label: 'FSA 578', badge: 'FSA' },
  insurance: { label: 'Insurance', badge: 'INS' },
  claims: { label: 'Claims', badge: 'CLM' },
  'grain-tickets': { label: 'Grain Tickets', badge: 'GT' },
  'farm-budget': { label: 'Farm Budget', badge: 'BUDG' },
}
