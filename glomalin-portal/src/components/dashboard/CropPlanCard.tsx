'use client'

import type { CachedCropPlan } from '@/lib/offline/types'
import { DashboardCard } from './DashboardCard'

interface CropPlanCardProps {
  plans: CachedCropPlan[]
}

export function CropPlanCard({ plans }: CropPlanCardProps) {
  const summary = plans[0]
  const subtitle = summary
    ? `${summary.crop} · ${summary.variety ?? '—'} · ${summary.acres.toFixed(1)} ac`
    : 'Crop plan loading…'

  return (
    <DashboardCard
      moduleId="field-history"
      moduleName="Field History"
      href="/app/field-history"
      subtitle={subtitle}
    >
      {plans.length > 1 && (
        <span className="text-xs font-mono text-glomalin-muted">
          +{plans.length - 1} more fields
        </span>
      )}
    </DashboardCard>
  )
}
