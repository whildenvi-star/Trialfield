/**
 * Timeline types for the Field Activity Timeline aggregation API.
 * These types are used across the data layer (fetch-sources.ts),
 * the aggregated route (/api/timeline/[fieldId]), and the per-source
 * progressive-loading routes (/api/timeline/[fieldId]/[source]).
 * Sources: budget, cert, fieldops, grain, observation, claim.
 */

/** The 6 data sources that contribute to a field's activity timeline. */
export type TimelineSource = 'budget' | 'cert' | 'fieldops' | 'grain' | 'observation' | 'claim'

/**
 * A unified activity record in the timeline, regardless of source.
 * Each entry originates from one of the 4 source systems and has
 * been normalized into this common shape for display and sorting.
 */
export interface TimelineEntry {
  /** Unique identifier for this entry (source-prefixed for uniqueness across sources). */
  id: string
  /** Which data source produced this entry. */
  source: TimelineSource
  /**
   * ISO date string for the activity, or null for PLANNED passes
   * that have not yet been scheduled to a specific date.
   */
  date: string | null
  /**
   * Guaranteed date string for sort purposes.
   * PLANNED entries with no date use "9999-12-31" to sort to the end of the list.
   */
  sortDate: string
  /**
   * High-level activity category, e.g. "Tillage", "Planting", "Harvest",
   * "Delivery", "SPRAYING", "FERTILIZER".
   */
  activityType: string
  /**
   * One-line collapsed display text shown in the timeline card.
   * e.g. "[Budget] Spring N - Urea 120 lb/ac"
   */
  summary: string
  /** Source-specific expanded detail object shown when the card is expanded. */
  detail: Record<string, unknown>
  /**
   * Pass status where applicable.
   * null for entries that don't have a pass lifecycle (e.g. grain deliveries).
   */
  status: 'planned' | 'confirmed' | 'completed' | null
  /**
   * ID of the paired entry when a budget planned pass and an organic-cert
   * confirmed operation represent the same real-world activity.
   * null when no pairing exists.
   */
  pairedWith: string | null
  /**
   * URL or embed path to view the original record in the source app.
   * null when no deep link is available (e.g. budget passes have no direct URL).
   */
  sourceLink: string | null
}

/**
 * Response shape for the aggregated GET /api/timeline/:fieldId endpoint.
 * Used by export/PDF flows that need all entries in one request.
 */
export interface TimelineResponse {
  fieldId: string
  fieldName: string
  /** All entries merged from all reachable sources, sorted chronologically. */
  entries: TimelineEntry[]
  /**
   * Names of source systems that failed or timed out.
   * Empty array when all sources responded successfully.
   */
  warnings: string[]
  /** The crop year these entries belong to. */
  year: number
}

/**
 * Response shape for the per-source GET /api/timeline/:fieldId/:source endpoint.
 * Used by the UI for progressive loading — 4 parallel requests, one per source.
 * Always returns HTTP 200 so the client can treat source failures as degraded,
 * not as network errors.
 */
export interface SingleSourceResponse {
  source: TimelineSource
  /** Entries from this source, or empty array if the source failed. */
  entries: TimelineEntry[]
  /**
   * null on success, human-readable error message if this source was unavailable.
   * The client uses this to show a warning banner for the failed source.
   */
  error: string | null
}
