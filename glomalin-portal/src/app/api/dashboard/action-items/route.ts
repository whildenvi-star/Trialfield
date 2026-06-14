import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CURRENT_CROP_YEAR } from '@/lib/config'
import type { ActionItem, ActionItemGroup } from '@/lib/action-items'
import { MODULE_SOURCES } from '@/lib/action-items'
import { fetchBudgetService, fetchGrainService } from '@/app/api/mobile/_lib/proxy'

/**
 * GET /api/dashboard/action-items
 *
 * Aggregates action items from 10 sources using Promise.allSettled for graceful
 * degradation when Express apps are offline:
 *   1. Supabase clu_records — unreported CLU records
 *   2. Supabase insurance_policies — policies with potential claim alerts
 *   3. Supabase claims — open/overdue claims
 *   4. grain-tickets Express (port 3007) — settlements with unmatched loads
 *   5. farm-budget Express (port 3001) — input products below 80% delivery target
 *   6. Supabase claims — claims with deadline within 14 days
 *   7. Supabase insurance_policies — prevented-planting policies (72h notice-of-loss window)
 *   8. Supabase sale_instruments — contracts with delivery window closing within 21 days
 *   9. Supabase crop_variants + sale_instruments — variants less than 25% priced
 *  10. Supabase insurance_policies + aph_records — policies missing APH for current year
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

  // ── Parallel fetch all 10 sources ───────────────────────────────────────────
  const deadlineWindow = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
  const deliveryWindow21d = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString()

  const [
    cluResult,
    insuranceResult,
    claimsResult,
    grainResult,
    budgetForecastResult,
    budgetDeliveriesResult,
    claimsDeadlineResult,
    preventedPlantingResult,
    saleInstrumentsResult,
    cropVariantsResult,
    saleInstrumentsPricedResult,
    allPoliciesResult,
    aphRecordsResult,
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

    // 6. Claims approaching deadline within 14 days
    supabase
      .from('claims')
      .select('id, stage, crop, deadline_at')
      .neq('stage', 'closed')
      .not('deadline_at', 'is', null)
      .lt('deadline_at', deadlineWindow),

    // 7. Prevented-planting policies with potential claim alert.
    // RMA requires notice of loss within 72 hours of the insurable cause for prevented planting —
    // flag these policies so the operator can act before the window closes.
    supabase
      .from('insurance_policies')
      .select('id, crop, farm_name')
      .eq('policy_year', CURRENT_CROP_YEAR)
      .eq('prevented_planting', true)
      .eq('claim_alert', 'potential'),

    // 8. Sale instruments with delivery window closing within 21 days (Supabase, not grain-tickets
    // service — this checks contracts in sale_instruments, not individual grain tickets)
    supabase
      .from('sale_instruments')
      .select('id, delivery_end, commodity_id, bushels, delivered_bu')
      .eq('crop_year', CURRENT_CROP_YEAR)
      .not('delivery_end', 'is', null)
      .lt('delivery_end', deliveryWindow21d)
      .neq('instrument_type', 'option')
      .neq('instrument_type', 'accumulator'),

    // 9a. Crop variants for unpriced-exposure check
    supabase
      .from('crop_variants')
      .select('id, name, estimated_bu, commodity_id')
      .eq('crop_year', CURRENT_CROP_YEAR)
      .gt('estimated_bu', 0),

    // 9b. Priced bushels per variant from sale_instruments
    supabase
      .from('sale_instruments')
      .select('crop_variant_id, priced_bu')
      .eq('crop_year', CURRENT_CROP_YEAR),

    // 10a. All insurance policies for current year (to find APH gaps)
    supabase
      .from('insurance_policies')
      .select('id')
      .eq('policy_year', CURRENT_CROP_YEAR),

    // 10b. APH records that exist for current year
    supabase
      .from('aph_records')
      .select('policy_id')
      .eq('crop_year', CURRENT_CROP_YEAR),
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
  }

  // Alert 7: Prevented-planting policies needing notice of loss
  if (
    preventedPlantingResult.status === 'fulfilled' &&
    !preventedPlantingResult.value.error &&
    preventedPlantingResult.value.data !== null
  ) {
    const ppCount = preventedPlantingResult.value.data.length
    if (ppCount > 0) {
      insuranceItems.push({
        id: 'ins-prevented-planting',
        severity: 'warning',
        summary: `${ppCount} prevented planting polic${ppCount === 1 ? 'y' : 'ies'} — notice of loss may be required`,
        count: ppCount,
        link: '/app/compliance?tab=insurance&filter=prevented',
      })
    }
  }

  // Alert 10: Policies missing APH record for current year
  if (
    allPoliciesResult.status === 'fulfilled' &&
    !allPoliciesResult.value.error &&
    allPoliciesResult.value.data !== null &&
    aphRecordsResult.status === 'fulfilled' &&
    !aphRecordsResult.value.error &&
    aphRecordsResult.value.data !== null
  ) {
    const aphPolicyIds = new Set(aphRecordsResult.value.data.map((r) => r.policy_id))
    const missingAphCount = allPoliciesResult.value.data.filter(
      (p) => !aphPolicyIds.has(p.id)
    ).length
    if (missingAphCount > 0) {
      insuranceItems.push({
        id: 'ins-missing-aph',
        severity: 'info',
        summary: `${missingAphCount} insurance polic${missingAphCount === 1 ? 'y' : 'ies'} missing APH for ${CURRENT_CROP_YEAR}`,
        count: missingAphCount,
        link: '/app/compliance?tab=insurance',
      })
    }
  }

  // Push insurance group if any source succeeded (at least one query returned)
  if (
    insuranceResult.status === 'fulfilled' ||
    preventedPlantingResult.status === 'fulfilled' ||
    allPoliciesResult.status === 'fulfilled'
  ) {
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
  }

  // Alert 6: Claims approaching deadline within 14 days
  if (
    claimsDeadlineResult.status === 'fulfilled' &&
    !claimsDeadlineResult.value.error &&
    claimsDeadlineResult.value.data !== null
  ) {
    const deadlineCount = claimsDeadlineResult.value.data.length
    if (deadlineCount > 0) {
      claimsItems.push({
        id: 'claims-deadline',
        severity: 'warning',
        summary: `${deadlineCount} claim${deadlineCount === 1 ? '' : 's'} with deadline within 14 days`,
        count: deadlineCount,
        link: '/app/compliance?tab=claims&filter=deadline',
      })
    }
  }

  if (
    claimsResult.status === 'fulfilled' ||
    claimsDeadlineResult.status === 'fulfilled'
  ) {
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

  // ── Marketing group ─────────────────────────────────────────────────────────
  const marketingItems: ActionItem[] = []

  // Alert 8: Grain contracts with delivery window closing within 21 days
  if (
    saleInstrumentsResult.status === 'fulfilled' &&
    !saleInstrumentsResult.value.error &&
    saleInstrumentsResult.value.data !== null
  ) {
    // Exclude fully-delivered contracts (delivered_bu >= bushels)
    const closingCount = saleInstrumentsResult.value.data.filter(
      (s) => (s.delivered_bu ?? 0) < (s.bushels ?? 0)
    ).length
    if (closingCount > 0) {
      marketingItems.push({
        id: 'mkt-delivery-window',
        severity: 'info',
        summary: `${closingCount} contract${closingCount === 1 ? '' : 's'} with delivery window closing within 21 days`,
        count: closingCount,
        link: '/app/marketing',
      })
    }
  }

  // Alert 9: Crop variants less than 25% priced (flag once past May of the crop year)
  const pastMayOfCropYear = Date.now() > new Date(`${CURRENT_CROP_YEAR}-05-31`).getTime()
  if (
    pastMayOfCropYear &&
    cropVariantsResult.status === 'fulfilled' &&
    !cropVariantsResult.value.error &&
    cropVariantsResult.value.data !== null &&
    saleInstrumentsPricedResult.status === 'fulfilled' &&
    !saleInstrumentsPricedResult.value.error &&
    saleInstrumentsPricedResult.value.data !== null
  ) {
    // Sum priced_bu per crop_variant_id
    const pricedByVariant = new Map<string, number>()
    for (const row of saleInstrumentsPricedResult.value.data) {
      if (row.crop_variant_id) {
        pricedByVariant.set(
          row.crop_variant_id,
          (pricedByVariant.get(row.crop_variant_id) ?? 0) + (row.priced_bu ?? 0)
        )
      }
    }
    const underpricedCount = cropVariantsResult.value.data.filter(
      (v) => (pricedByVariant.get(v.id) ?? 0) < (v.estimated_bu ?? 0) * 0.25
    ).length
    if (underpricedCount > 0) {
      marketingItems.push({
        id: 'mkt-unpriced-exposure',
        severity: 'info',
        summary: `${underpricedCount} crop variant${underpricedCount === 1 ? '' : 's'} less than 25% priced`,
        count: underpricedCount,
        link: '/app/marketing',
      })
    }
  }

  if (marketingItems.length > 0) {
    groups.push({
      module: 'marketing',
      label: MODULE_SOURCES.marketing.label,
      badge: MODULE_SOURCES.marketing.badge,
      items: marketingItems,
      offline: false,
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
