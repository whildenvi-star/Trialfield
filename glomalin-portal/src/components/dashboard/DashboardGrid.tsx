'use client'

import { useDashboardData } from './use-dashboard-data'
import { DashboardCardSkeleton } from './dashboard-card-skeleton'
import { DashboardCard } from './DashboardCard'
import { CropPlanCard } from './CropPlanCard' // Created in 03-02-PLAN
import { FieldOpsCard } from './FieldOpsCard' // Created in 03-02-PLAN
import { ActionItemsStrip } from './ActionItemsStrip'
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

  const fullWidthIds = new Set(['field-ops', 'field-history'])
  const fullWidthModules = visibleModules.filter(m => fullWidthIds.has(m.id))
  const gridModules = visibleModules.filter(m => !fullWidthIds.has(m.id))

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      {!isOnline && lastSyncAt && (
        <p className="text-xs font-mono text-glomalin-muted text-center">
          Offline — showing data from {lastSyncAt}
        </p>
      )}
      <ActionItemsStrip />
      {/* Full-width data cards */}
      {fullWidthModules.map((m) => {
        if (m.id === 'field-ops') return <FieldOpsCard key={m.id} plans={plans} role={role} />
        if (m.id === 'field-history') return <CropPlanCard key={m.id} plans={plans} />
        return null
      })}
      {/* 2-column grid for generic module cards */}
      {gridModules.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {gridModules.map((m) => (
            <DashboardCard
              key={m.id}
              moduleId={m.id}
              moduleName={m.label}
              href={m.route}
              subtitle={m.sublabel}
            />
          ))}
        </div>
      )}
    </div>
  )
}
