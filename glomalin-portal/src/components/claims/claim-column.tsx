'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { STAGE_LABELS, isOverdue } from '@/lib/claims/calc'
import { ClaimCard, type Claim } from './claim-card'

interface ClaimColumnProps {
  stage: string
  claims: Claim[]
  onCardClick: (id: string) => void
}

/**
 * Droppable Kanban column for a single pipeline stage.
 * Overdue claims are pinned to the top with red styling.
 * SortableContext items array matches the rendered visual order (overdue first).
 */
export function ClaimColumn({ stage, claims, onCardClick }: ClaimColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })

  // Build sorted array: overdue first, then non-overdue (per plan spec)
  // Normalize deadline_at to string | null (not undefined) for isOverdue
  const overdueClaims = claims.filter((c) =>
    isOverdue({ deadline_at: c.deadline_at ?? null, stage: c.stage }),
  )
  const activeClaims = claims.filter(
    (c) => !isOverdue({ deadline_at: c.deadline_at ?? null, stage: c.stage }),
  )
  const sortedClaims = [...overdueClaims, ...activeClaims]

  return (
    <div className="flex-none w-64 flex flex-col">
      {/* Column header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="text-xs font-mono uppercase text-glomalin-muted tracking-wider">
          {STAGE_LABELS[stage] ?? stage}
        </h3>
        {claims.length > 0 && (
          <span className="text-xs font-mono text-glomalin-muted bg-glomalin-border rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
            {claims.length}
          </span>
        )}
      </div>

      {/* Droppable + sortable area */}
      <SortableContext
        items={sortedClaims.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className={[
            'flex-1 flex flex-col gap-2 rounded p-2 min-h-[120px] transition-colors',
            isOver ? 'bg-glomalin-accent/5 border border-dashed border-glomalin-accent/40' : 'border border-transparent',
          ].join(' ')}
        >
          {sortedClaims.length === 0 ? (
            <div className="flex items-center justify-center flex-1 min-h-[80px]">
              <span className="text-xs font-mono text-glomalin-border">No claims</span>
            </div>
          ) : (
            sortedClaims.map((claim) => (
              <ClaimCard
                key={claim.id}
                claim={claim}
                onCardClick={onCardClick}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  )
}
