'use client'

type BadgeStatus = 'unreported' | 'reported' | 'alert' | 'pending' | 'overdue' | 'ok'

interface ComplianceBadgeProps {
  status: BadgeStatus
  label?: string
}

const badgeStyles: Record<BadgeStatus, string> = {
  unreported: 'text-amber-400 bg-amber-900',
  reported: 'text-green-400 bg-green-900',
  alert: 'text-red-400 bg-red-900',
  pending: 'text-amber-400 bg-amber-900',
  overdue: 'text-red-400 bg-red-900 font-bold border border-red-700',
  ok: 'text-green-400 bg-green-900',
}

export function ComplianceBadge({ status, label }: ComplianceBadgeProps) {
  return (
    <span
      className={`inline-block text-xs font-mono px-2 py-0.5 rounded ${badgeStyles[status]}`}
    >
      {label ?? status}
    </span>
  )
}
