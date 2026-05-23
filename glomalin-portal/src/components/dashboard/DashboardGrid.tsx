'use client'

import { useDashboardData } from './use-dashboard-data'
import { DashboardCardSkeleton } from './dashboard-card-skeleton'
import { DashboardCard } from './DashboardCard'
import { CropPlanCard } from './CropPlanCard' // Created in 03-02-PLAN
import { FieldOpsCard } from './FieldOpsCard' // Created in 03-02-PLAN
import { MODULES } from '@/lib/modules'

interface DashboardGridProps {
  role: string
  grantedModuleIds: string[]
}

// Fixed module display order — consistent and predictable for daily use
const MODULE_ORDER = [
  'field-ops',
  'field-history',
  'weather',
  'maps',
  'observations',
  'enterprise-summary',
  'compliance',
  'marketing',
  'farm-budget',
]

export function DashboardGrid({ role, grantedModuleIds }: DashboardGridProps) {
  const { plans, isLoading, isOnline, lastSyncAt } = useDashboardData()

  // Filter to accessible modules, sorted by fixed order
  const visibleModules = MODULES
    .filter((m) => grantedModuleIds.includes(m.id))
    .sort((a, b) => {
      const ai = MODULE_ORDER.indexOf(a.id)
      const bi = MODULE_ORDER.indexOf(b.id)
      // Modules not in the fixed order go to the end
      return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi)
    })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 px-4 py-4">
        <DashboardCardSkeleton />
        <DashboardCardSkeleton />
        <DashboardCardSkeleton />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      {!isOnline && lastSyncAt && (
        <p className="text-xs font-mono text-glomalin-muted text-center">
          Offline — showing data from {lastSyncAt}
        </p>
      )}
      {visibleModules.map((m) => {
        switch (m.id) {
          case 'field-ops':
            return <FieldOpsCard key={m.id} plans={plans} role={role} />
          case 'field-history':
            return <CropPlanCard key={m.id} plans={plans} />
          default:
            return (
              <DashboardCard
                key={m.id}
                moduleId={m.id}
                moduleName={m.label}
                href={m.route}
                subtitle={m.sublabel}
              />
            )
        }
      })}
    </div>
  )
}
