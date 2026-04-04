import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CURRENT_CROP_YEAR } from '@/lib/config'
import type { ActionItem, ActionItemGroup } from '@/lib/action-items'
import { MODULE_SOURCES } from '@/lib/action-items'
import { fetchBudgetService, fetchGrainService } from '@/app/api/mobile/_lib/proxy'

/**
 * GET /api/dashboard/action-items
 *
 * Aggregates action items from 5 sources using Promise.allSettled for graceful
 * degradation when Express apps are offline:
 *   1. Supabase clu_records — unreported CLU records
 *   2. Supabase insurance_policies — policies with potential claim alerts
 *   3. Supabase claims — open/overdue claims
 *   4. grain-tickets Express (port 3007) — settlements with unmatched loads
 *   5. farm-budget Express (port 3001) — input products below 80% delivery target
 *
 * Response shape: { groups: ActionItemGroup[], totalCount: number, fetchedAt: number }
 */
export async function GET() {
  const supabase = await createClient()

  // Auth guard
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parallel fetch all 5 sources ────────────────────────────────────────────
  const [
    cluResult,
    insuranceResult,
    claimsResult,
    grainResult,
    budgetForecastResult,
    budgetDeliveriesResult,
  ] = await Promise.allSettled([
    // 1. CLU records
    supabase
      .from('clu_records')
      .select('id, reported')
      .eq('crop_year', CURRENT_CROP_YEAR),

    // 2. Insurance policies with claim alerts
    supabase
      .from('insurance_policies')
      .select('id')
      .eq('policy_year', CURRENT_CROP_YEAR)
      .eq('claim_alert', 'potential'),

    // 3. Open claims (non-closed)
    supabase
      .from('claims')
      .select('id, stage, created_at')
      .neq('stage', 'closed'),

    // 4. Grain-tickets settlements
    fetchGrainService(`/api/settlements?cropYear=${CURRENT_CROP_YEAR}`),

    // 5a. Farm-budget forecast
    fetchBudgetService('/api/forecast'),

    // 5b. Farm-budget deliveries
    fetchBudgetService('/api/deliveries'),
  ])

  const groups: ActionItemGroup[] = []

  // ── FSA group ───────────────────────────────────────────────────────────────
  const fsaItems: ActionItem[] = []
  if (
    cluResult.status === 'fulfilled' &&
    !cluResult.value.error &&
    cluResult.value.data !== null
  ) {
    const unreportedCount = cluResult.value.data.filter(
      (row) => row.reported === false || row.reported === null
    ).length
    if (unreportedCount > 0) {
      fsaItems.push({
        id: 'fsa-unreported',
        severity: 'warning',
        summary: `${unreportedCount} CLU record${unreportedCount === 1 ? '' : 's'} missing acreage report`,
        count: unreportedCount,
        link: '/app/compliance?tab=acreage&filter=unreported',
      })
    }
    groups.push({
      module: 'fsa-578',
      label: MODULE_SOURCES['fsa-578'].label,
      badge: MODULE_SOURCES['fsa-578'].badge,
      items: fsaItems,
      offline: false,
    })
  }
  // If Supabase query failed, skip the group (Supabase outage is rare; don't show misleading offline state)

  // ── Insurance group ─────────────────────────────────────────────────────────
  const insuranceItems: ActionItem[] = []
  if (
    insuranceResult.status === 'fulfilled' &&
    !insuranceResult.value.error &&
    insuranceResult.value.data !== null
  ) {
    const alertCount = insuranceResult.value.data.length
    if (alertCount > 0) {
      insuranceItems.push({
        id: 'ins-claim-alerts',
        severity: 'warning',
        summary: `${alertCount} polic${alertCount === 1 ? 'y' : 'ies'} with potential claim alerts`,
        count: alertCount,
        link: '/app/compliance?tab=insurance&filter=claim-alerts',
      })
    }
    groups.push({
      module: 'insurance',
      label: MODULE_SOURCES.insurance.label,
      badge: MODULE_SOURCES.insurance.badge,
      items: insuranceItems,
      offline: false,
    })
  }

  // ── Claims group ────────────────────────────────────────────────────────────
  const claimsItems: ActionItem[] = []
  if (
    claimsResult.status === 'fulfilled' &&
    !claimsResult.value.error &&
    claimsResult.value.data !== null
  ) {
    const openClaims = claimsResult.value.data
    const openCount = openClaims.length

    if (openCount > 0) {
      claimsItems.push({
        id: 'claims-open',
        severity: 'info',
        summary: `${openCount} open claim${openCount === 1 ? '' : 's'} in pipeline`,
        count: openCount,
        link: '/app/compliance?tab=claims',
      })
    }

    // Overdue: filed or notice-of-loss older than 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    const overdueCount = openClaims.filter(
      (c) =>
        (c.stage === 'filed' || c.stage === 'notice-of-loss') &&
        new Date(c.created_at).getTime() < thirtyDaysAgo
    ).length
    if (overdueCount > 0) {
      claimsItems.push({
        id: 'claims-overdue',
        severity: 'warning',
        summary: `${overdueCount} claim${overdueCount === 1 ? '' : 's'} overdue (>30 days)`,
        count: overdueCount,
        link: '/app/compliance?tab=claims&filter=overdue',
      })
    }

    groups.push({
      module: 'claims',
      label: MODULE_SOURCES.claims.label,
      badge: MODULE_SOURCES.claims.badge,
      items: claimsItems,
      offline: false,
    })
  }

  // ── Grain tickets group ─────────────────────────────────────────────────────
  const grainItems: ActionItem[] = []
  let grainOffline = false

  if (grainResult.status === 'rejected') {
    grainOffline = true
  } else if (!grainResult.value.ok) {
    grainOffline = true
  } else {
    try {
      const settlements = await grainResult.value.json()
      const unmatchedCount = Array.isArray(settlements)
        ? settlements.filter(
            (s: { _count?: { lines?: number } }) => (s._count?.lines ?? 0) === 0
          ).length
        : 0
      if (unmatchedCount > 0) {
        grainItems.push({
          id: 'gt-unmatched',
          severity: 'info',
          summary: `${unmatchedCount} settlement${unmatchedCount === 1 ? '' : 's'} with unmatched loads`,
          count: unmatchedCount,
          link: '/app/grain-tickets?tab=settlements',
        })
      }
    } catch {
      grainOffline = true
    }
  }

  // Only include grain group if there are items or it is offline
  if (grainItems.length > 0 || grainOffline) {
    groups.push({
      module: 'grain-tickets',
      label: MODULE_SOURCES['grain-tickets'].label,
      badge: MODULE_SOURCES['grain-tickets'].badge,
      items: grainItems,
      offline: grainOffline,
    })
  }

  // ── Farm budget group ───────────────────────────────────────────────────────
  const budgetItems: ActionItem[] = []
  let budgetOffline = false

  const forecastFailed =
    budgetForecastResult.status === 'rejected' || !budgetForecastResult.value.ok
  const deliveriesFailed =
    budgetDeliveriesResult.status === 'rejected' || !budgetDeliveriesResult.value.ok

  if (forecastFailed || deliveriesFailed) {
    budgetOffline = true
  } else {
    try {
      const [forecast, deliveries] = await Promise.all([
        budgetForecastResult.value.json(),
        budgetDeliveriesResult.value.json(),
      ])

      // Build a map of productId/name -> delivered qty from deliveries
      const deliveredByProduct = new Map<string, number>()
      if (Array.isArray(deliveries)) {
        for (const delivery of deliveries) {
          const key = delivery.productId ?? delivery.productName ?? delivery.product
          if (key) {
            deliveredByProduct.set(key, (deliveredByProduct.get(key) ?? 0) + (delivery.qty ?? delivery.quantity ?? 0))
          }
        }
      }

      // Count products below 80% delivery target
      let shortfallCount = 0
      if (Array.isArray(forecast)) {
        for (const item of forecast) {
          const key = item.productId ?? item.productName ?? item.product
          const totalQty = item.totalQty ?? item.plannedQty ?? 0
          if (totalQty <= 0 || !key) continue
          const delivered = deliveredByProduct.get(key) ?? 0
          if (delivered < totalQty * 0.8) {
            shortfallCount++
          }
        }
      }

      if (shortfallCount > 0) {
        budgetItems.push({
          id: 'budget-delivery-shortfall',
          severity: 'info',
          summary: `${shortfallCount} input product${shortfallCount === 1 ? '' : 's'} below 80% delivery target`,
          count: shortfallCount,
          link: '/app/farm-budget?tab=deliveries',
        })
      }
    } catch {
      budgetOffline = true
    }
  }

  // Only include budget group if there are items or it is offline
  if (budgetItems.length > 0 || budgetOffline) {
    groups.push({
      module: 'farm-budget',
      label: MODULE_SOURCES['farm-budget'].label,
      badge: MODULE_SOURCES['farm-budget'].badge,
      items: budgetItems,
      offline: budgetOffline,
    })
  }

  // ── Totals ──────────────────────────────────────────────────────────────────
  const totalCount = groups.reduce((sum, g) => sum + g.items.length, 0)

  return NextResponse.json(
    { groups, totalCount, fetchedAt: Date.now() },
    {
      headers: {
        'Cache-Control': 'no-cache',
      },
    }
  )
}
