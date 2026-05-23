'use client'

import { useState } from 'react'
import type { CachedCropPlan } from '@/lib/offline/types'
import { offlineQueue } from '@/lib/offline/db'
import { DashboardCard } from './DashboardCard'

interface FieldOpsCardProps {
  plans: CachedCropPlan[]
  role: string
}

interface PendingPass {
  plan: CachedCropPlan
  pass: CachedCropPlan['passes'][number]
}

export function FieldOpsCard({ plans, role: _role }: FieldOpsCardProps) {
  const [localPlans, setLocalPlans] = useState<CachedCropPlan[]>(plans)

  const pendingPasses: PendingPass[] = localPlans.flatMap((plan) =>
    plan.passes
      .filter((pass) => pass.status === 'PLANNED')
      .map((pass) => ({ plan, pass }))
  )

  async function handleMarkDone(plan: CachedCropPlan, pass: CachedCropPlan['passes'][number]) {
    // 1. Write to offline queue first
    await offlineQueue.add({
      type: 'confirm-pass',
      fieldId: plan.fieldName,
      passId: pass.id,
      passType: pass.type,
      operationDate: new Date().toISOString().split('T')[0],
      operatorId: '',
      operatorName: '',
      description: 'Marked complete from dashboard',
    })
    // 2. Optimistic update
    setLocalPlans((prev) =>
      prev.map((p) =>
        p === plan
          ? {
              ...p,
              passes: p.passes.map((ps) =>
                ps.id === pass.id ? { ...ps, status: 'CONFIRMED' as const } : ps
              ),
            }
          : p
      )
    )
  }

  return (
    <DashboardCard moduleId="field-ops" moduleName="Field Ops" href="/app/field-ops">
      {pendingPasses.length === 0 ? (
        <p className="text-xs font-mono text-glomalin-muted">All passes complete</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {pendingPasses.slice(0, 3).map(({ plan, pass }) => (
            <li key={pass.id} className="flex items-center justify-between">
              <span className="text-xs font-mono text-glomalin-text">
                {pass.type} · {plan.fieldName}
              </span>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  void handleMarkDone(plan, pass)
                }}
                className="text-xs font-mono text-glomalin-accent border border-glomalin-border rounded px-2 min-h-[44px] min-w-[44px]"
              >
                Done
              </button>
            </li>
          ))}
          {pendingPasses.length > 3 && (
            <li className="text-xs font-mono text-glomalin-muted">
              +{pendingPasses.length - 3} more
            </li>
          )}
        </ul>
      )}
    </DashboardCard>
  )
}
