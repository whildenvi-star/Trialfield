import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ActionItemsList } from '@/components/dashboard/action-items-list'
import { CURRENT_CROP_YEAR } from '@/lib/config'
import type { ActionItemsResponse } from '@/lib/action-items'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Defensive check — middleware should catch this, but be safe
  if (!user) {
    redirect('/login')
  }

  // Server-side pre-fetch: Supabase-only partial data for fast initial render.
  // The ActionItemsList client component re-fetches the full set (including Express apps)
  // on mount, replacing this partial data.
  let initial: ActionItemsResponse | null = null

  try {
    const results = await Promise.allSettled([
      supabase
        .from('clu_records')
        .select('id, reported')
        .eq('crop_year', CURRENT_CROP_YEAR),
      supabase
        .from('insurance_policies')
        .select('id')
        .eq('policy_year', CURRENT_CROP_YEAR)
        .eq('claim_alert', 'potential'),
      supabase
        .from('claims')
        .select('id, due_date')
        .neq('stage', 'closed'),
    ])

    const groups: ActionItemsResponse['groups'] = []

    // FSA group: unreported CLU records
    const fsaResult = results[0]
    if (
      fsaResult.status === 'fulfilled' &&
      !fsaResult.value.error &&
      fsaResult.value.data !== null
    ) {
      const unreported = fsaResult.value.data.filter((r) => r.reported !== true)
      if (unreported.length > 0) {
        groups.push({
          module: 'fsa-578',
          label: 'FSA 578',
          badge: 'FSA',
          offline: false,
          items: [
            {
              id: 'fsa-unreported',
              severity: 'warning',
              summary: `${unreported.length} CLU record${unreported.length === 1 ? '' : 's'} not yet reported`,
              count: unreported.length,
              link: '/app/compliance?tab=acreage&filter=unreported',
            },
          ],
        })
      }
    }

    // Insurance group: potential claim alerts
    const insResult = results[1]
    if (
      insResult.status === 'fulfilled' &&
      !insResult.value.error &&
      insResult.value.data !== null &&
      insResult.value.data.length > 0
    ) {
      const n = insResult.value.data.length
      groups.push({
        module: 'insurance',
        label: 'Insurance',
        badge: 'INS',
        offline: false,
        items: [
          {
            id: 'ins-claim-alerts',
            severity: 'warning',
            summary: `${n} polic${n === 1 ? 'y' : 'ies'} with potential claim alert`,
            count: n,
            link: '/app/compliance?tab=insurance&filter=claim-alerts',
          },
        ],
      })
    }

    // Claims group: open claims
    const claimsResult = results[2]
    if (
      claimsResult.status === 'fulfilled' &&
      !claimsResult.value.error &&
      claimsResult.value.data !== null &&
      claimsResult.value.data.length > 0
    ) {
      const n = claimsResult.value.data.length
      const now = Date.now()
      const overdue = claimsResult.value.data.filter(
        (c) => c.due_date && new Date(c.due_date).getTime() < now
      ).length
      const items: ActionItemsResponse['groups'][0]['items'] = []
      if (overdue > 0) {
        items.push({
          id: 'claims-overdue',
          severity: 'warning',
          summary: `${overdue} claim${overdue === 1 ? '' : 's'} past due date`,
          count: overdue,
          link: '/app/compliance?tab=claims&filter=overdue',
        })
      }
      const open = n - overdue
      if (open > 0) {
        items.push({
          id: 'claims-open',
          severity: 'info',
          summary: `${open} claim${open === 1 ? '' : 's'} open`,
          count: open,
          link: '/app/compliance?tab=claims&filter=open',
        })
      }
      if (items.length > 0) {
        groups.push({
          module: 'claims',
          label: 'Claims',
          badge: 'CLM',
          offline: false,
          items,
        })
      }
    }

    const totalCount = groups.reduce((sum, g) => sum + g.items.length, 0)

    if (groups.length > 0) {
      initial = {
        groups,
        totalCount,
        fetchedAt: Date.now(),
      }
    }
  } catch {
    // SSR pre-fetch failed — client component will fetch full data on mount
    initial = null
  }

  return (
    <div>
      <h1 className="text-2xl font-bold font-mono text-glomalin-text tracking-wide">
        Dashboard
      </h1>
      <p className="mt-2 mb-6 text-glomalin-muted font-mono text-sm">
        Action Items
      </p>

      {/* Action items: replaces static module navigation cards.
          SSR provides Supabase-only partial data; client re-fetches the full
          set (Supabase + Express apps) on mount. Offline Express apps show
          dimmed groups with "Unavailable" tag. */}
      <ActionItemsList initial={initial} />
    </div>
  )
}
