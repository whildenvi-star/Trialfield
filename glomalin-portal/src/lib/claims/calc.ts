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
