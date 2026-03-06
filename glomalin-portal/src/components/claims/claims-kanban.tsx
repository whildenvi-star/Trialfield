'use client'

import { useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { STAGE_ORDER } from '@/lib/claims/calc'
import { ClaimColumn } from './claim-column'
import { ClaimCard, type Claim } from './claim-card'

interface ClaimsKanbanProps {
  claims: Claim[]
  onStageChange: (claimId: string, newStage: string) => Promise<void>
  onCardClick: (id: string) => void
}

/**
 * Multi-container Kanban board for claims pipeline.
 * One DndContext wraps all 6 stage columns.
 * ClaimsKanban is a named export — consumed via dynamic({ ssr: false }) from ClaimsWorkspace.
 *
 * Cross-container detection in onDragEnd:
 *   - If over.id is in STAGE_ORDER, it was dropped on a column droppable
 *   - Otherwise, read over.data.current.stage (passed to useSortable data)
 */
export function ClaimsKanban({
  claims,
  onStageChange,
  onCardClick,
}: ClaimsKanbanProps) {
  const [activeClaimId, setActiveClaimId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  function handleDragStart({ active }: DragStartEvent) {
    setActiveClaimId(active.id as string)
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveClaimId(null)
    if (!over) return

    const activeStage = (active.data.current as { stage: string } | undefined)?.stage
    if (!activeStage) return

    // Determine target stage: check if over.id is a stage column id first
    const targetStage = (STAGE_ORDER as readonly string[]).includes(over.id as string)
      ? (over.id as string)
      : (over.data.current as { stage?: string } | undefined)?.stage

    if (!targetStage || activeStage === targetStage) return

    onStageChange(active.id as string, targetStage)
  }

  const activeClaim = claims.find((c) => c.id === activeClaimId) ?? null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-6 pt-2">
        {STAGE_ORDER.map((stage) => (
          <ClaimColumn
            key={stage}
            stage={stage}
            claims={claims.filter((c) => c.stage === stage)}
            onCardClick={onCardClick}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeClaim ? (
          <ClaimCard claim={activeClaim} isDragOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
