'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  getDeadlineBorderClass,
  getDeadlineCountdown,
  isOverdue,
} from '@/lib/claims/calc'

export interface Claim {
  id: string
  stage: string
  crop?: string | null
  coverage_type?: string | null
  coverage_level?: number | null
  deadline_at?: string | null
  effective_guarantee?: number | null
  indemnity_amount?: number | null
  policy_id?: string | null
  date_of_loss?: string | null
  cause_of_loss?: string | null
  estimated_loss_bu?: number | null
  appraised_value?: number | null
  deductible_amount?: number | null
  adjuster_name?: string | null
  adjuster_phone?: string | null
  notes?: string | null
  created_at?: string | null
  [key: string]: unknown
}

interface ClaimCardProps {
  claim: Claim
  onCardClick?: (id: string) => void
  isDragOverlay?: boolean
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Individual claim card for the Kanban board.
 * Draggable via useSortable. Shows crop, coverage, deadline badge, claim amount.
 * Overdue claims have a red background tint.
 */
export function ClaimCard({
  claim,
  onCardClick,
  isDragOverlay = false,
}: ClaimCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: claim.id,
      data: { stage: claim.stage, claim },
    })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const borderClass = getDeadlineBorderClass(claim.deadline_at ?? null, claim.stage)
  const countdown = getDeadlineCountdown(claim.deadline_at ?? null, claim.stage)
  const overdue = isOverdue({ deadline_at: claim.deadline_at ?? null, stage: claim.stage })

  // Displayed amount: prefer indemnity if present, fall back to effective guarantee
  const displayAmount =
    claim.indemnity_amount != null ? claim.indemnity_amount : claim.effective_guarantee

  // Countdown pill color class
  let countdownPillClass = 'bg-[#7A9E7E]/10 text-[#7A9E7E] border-[#7A9E7E]/30'
  if (countdown) {
    if (overdue) {
      countdownPillClass = 'bg-red-900/20 text-red-400 border-red-600/40 animate-pulse'
    } else if (countdown.includes('d left')) {
      const days = parseInt(countdown)
      if (days < 7) {
        countdownPillClass = 'bg-red-900/20 text-red-400 border-red-600/40'
      } else if (days <= 30) {
        countdownPillClass = 'bg-amber-900/20 text-amber-400 border-amber-600/40'
      }
    } else if (countdown === 'Due today') {
      countdownPillClass = 'bg-red-900/20 text-red-400 border-red-600/40'
    }
  }

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      style={isDragOverlay ? undefined : style}
      {...(isDragOverlay ? {} : attributes)}
      {...(isDragOverlay ? {} : listeners)}
      onClick={
        isDragOverlay || !onCardClick
          ? undefined
          : (e) => {
              e.stopPropagation()
              onCardClick(claim.id)
            }
      }
      className={[
        'rounded border bg-[#0e0c0b] p-3 font-mono text-xs',
        'cursor-grab active:cursor-grabbing select-none',
        'transition-shadow hover:shadow-md hover:shadow-black/40',
        borderClass,
        overdue ? 'bg-red-900/10' : '',
        isDragOverlay ? 'shadow-xl rotate-1 opacity-95' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Crop name */}
      <p className="text-[#e8d8c0] font-semibold text-sm mb-1 truncate">
        {claim.crop ?? '—'}
      </p>

      {/* Coverage type + level */}
      <p className="text-[#6a5a4a] mb-2">
        {claim.coverage_type ?? '—'}
        {claim.coverage_level != null ? ` ${claim.coverage_level}%` : ''}
      </p>

      {/* Bottom row: deadline badge + claim amount */}
      <div className="flex items-center justify-between gap-2">
        {countdown ? (
          <span
            className={[
              'inline-block border rounded px-1.5 py-0.5 text-xs',
              countdownPillClass,
            ].join(' ')}
          >
            {countdown}
          </span>
        ) : (
          <span />
        )}

        <span className="text-[#e8d8c0] text-right">
          {formatCurrency(displayAmount)}
        </span>
      </div>
    </div>
  )
}
