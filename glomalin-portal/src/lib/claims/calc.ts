/**
 * lib/claims/calc.ts
 *
 * Pure deadline calculation helpers for crop insurance claims.
 * No Supabase imports — usable in both server and client contexts.
 *
 * Deadline model (per locked design decisions in 31-CONTEXT.md):
 *   - Auto-calculated from stage entry date + standard filing windows
 *   - User can override any auto-calculated deadline (deadline_overridden flag)
 *   - Deadlines recalculate on stage transitions
 *
 * Note on regulatory vs. default deadlines:
 *   - INITIAL_DEADLINE_DAYS (15) is the confirmed FCIC Notice of Loss window
 *     (CCC-576 must be filed within 15 calendar days of loss event).
 *   - STAGE_DEADLINE_DAYS values are reasonable processing norms, NOT hard
 *     regulatory windows. All are user-overridable.
 */

/**
 * Add `days` calendar days to `date` and return the resulting Date.
 * Does not mutate the input.
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Notice of Loss filing window: 15 calendar days after the date of loss.
 * Source: FCIC / USDA Service Center — CCC-576 must be filed within 15 days.
 * This is used to set the initial deadline when creating a claim from a policy.
 */
export const INITIAL_DEADLINE_DAYS = 15

/**
 * Stage-based deadline offsets (days from stage_entered_at).
 * Applied automatically on stage transitions unless deadline_overridden = true.
 *
 * notice_of_loss: uses INITIAL_DEADLINE_DAYS from date_of_loss (not stage entry),
 *   so it is intentionally absent from this map.
 * closed: no deadline — absent from map, computeDeadline returns null.
 * settled: 30 days — gives producer time to confirm settlement details.
 */
export const STAGE_DEADLINE_DAYS: Partial<Record<string, number>> = {
  filed: 60,            // ~60 days for adjuster inspection scheduling
  adjuster_assigned: 30, // 30 days for adjuster to complete appraisal
  under_review: 45,     // 45 days for underwriter review
  settled: 30,          // 30 days to finalize and close the claim
}

/**
 * Compute the deadline date for a given stage and the time that stage was entered.
 *
 * Returns:
 *   - A Date if the stage has a defined deadline offset in STAGE_DEADLINE_DAYS
 *   - null for stages with no deadline (notice_of_loss uses INITIAL_DEADLINE_DAYS
 *     from date_of_loss instead — handled by the POST /api/claims route; closed has
 *     no deadline at all)
 *
 * Usage in PATCH /api/claims/[id]:
 *   const deadline = computeDeadline(patch.stage, new Date())
 *   if (deadline && !patch.deadline_overridden) {
 *     updateData.deadline_at = deadline.toISOString()
 *   }
 */
export function computeDeadline(stage: string, stageEnteredAt: Date): Date | null {
  const days = STAGE_DEADLINE_DAYS[stage]
  if (days === undefined) return null
  return addDays(stageEnteredAt, days)
}

// ---------------------------------------------------------------------------
// Kanban UI helpers — deadline display and card styling
// ---------------------------------------------------------------------------

/**
 * Visual column order for the Kanban board (per 32-CONTEXT.md user decision).
 * This is NOT the DB enum order — visual order differs intentionally.
 * 'settled' maps to display label "Settled / Approved" since the DB enum
 * uses `settled` rather than `approved_denied` (see 32-RESEARCH.md open question 1).
 */
export const STAGE_ORDER = [
  'notice_of_loss',
  'filed',
  'under_review',
  'adjuster_assigned',
  'settled',
  'closed',
] as const

/** Display labels for each pipeline stage */
export const STAGE_LABELS: Record<string, string> = {
  notice_of_loss: 'Notice of Loss',
  filed: 'Filed',
  under_review: 'Under Review',
  adjuster_assigned: 'Adjuster Assigned',
  settled: 'Settled / Approved',
  closed: 'Closed',
}

/**
 * Returns the number of calendar days remaining until the deadline.
 * Negative values indicate an overdue claim.
 * Returns null when the claim is closed or has no deadline.
 */
export function getDeadlineDaysRemaining(
  deadlineAt: string | null,
  stage: string,
): number | null {
  if (!deadlineAt || stage === 'closed') return null
  const now = new Date()
  const deadline = new Date(deadlineAt)
  return Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Returns Tailwind CSS classes for the card left border based on deadline urgency:
 *   - overdue (days < 0):   pulsing red
 *   - urgent  (days < 7):   red
 *   - soon    (days <= 30): amber
 *   - ok      (days > 30):  green
 *   - no deadline:          default soil border
 */
export function getDeadlineBorderClass(
  deadlineAt: string | null,
  stage: string,
): string {
  const days = getDeadlineDaysRemaining(deadlineAt, stage)
  if (days === null) return 'border-[#2a2218]'
  if (days < 0) return 'border-l-4 border-l-red-600 animate-pulse border-[#2a2218]'
  if (days < 7) return 'border-l-4 border-l-red-500 border-[#2a2218]'
  if (days <= 30) return 'border-l-4 border-l-amber-500 border-[#2a2218]'
  return 'border-l-4 border-l-[#7A9E7E] border-[#2a2218]'
}

/**
 * Returns a human-readable countdown string for the deadline badge on a card.
 * Examples: "14d left", "Due today", "3d overdue", or null when no deadline applies.
 */
export function getDeadlineCountdown(
  deadlineAt: string | null,
  stage: string,
): string | null {
  const days = getDeadlineDaysRemaining(deadlineAt, stage)
  if (days === null) return null
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Due today'
  return `${days}d left`
}

/**
 * Returns true if the claim is overdue (deadline passed and claim is not closed).
 */
export function isOverdue(claim: {
  deadline_at: string | null
  stage: string
}): boolean {
  const days = getDeadlineDaysRemaining(claim.deadline_at, claim.stage)
  return days !== null && days < 0
}
