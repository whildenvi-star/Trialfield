'use client'

import { useEffect, useState } from 'react'
import { offlineQueue } from '@/lib/offline/db'
import { observationQueue } from '@/lib/offline/observation-queue'
import type { QueuedOperation } from '@/lib/offline/types'

interface QueueItem {
  label: string
  timestamp: string
}

interface QueueDetailSheetProps {
  open: boolean
  onClose: () => void
}

function formatTimestamp(iso: string | number): string {
  const d = typeof iso === 'number' ? new Date(iso) : new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function opTypeLabel(type: QueuedOperation['type']): string {
  switch (type) {
    case 'confirm-pass': return 'Confirm pass'
    case 'add-pass':     return 'Add pass'
    default:             return 'Field operation'
  }
}

export function QueueDetailSheet({ open, onClose }: QueueDetailSheetProps) {
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(false)

  // Load items from both queues whenever the sheet opens
  useEffect(() => {
    if (!open) return
    setLoading(true)

    Promise.all([
      offlineQueue.getPending(),
      observationQueue.getPending(),
    ]).then(([ops, obs]) => {
      const opItems: QueueItem[] = ops.map((op) => ({
        label: opTypeLabel(op.type),
        timestamp: formatTimestamp(op.createdAt),
      }))
      const obsItems: QueueItem[] = obs.map((ob) => ({
        label: 'Field observation',
        timestamp: formatTimestamp(ob.createdAt),
      }))
      setItems([...opItems, ...obsItems])
    }).catch(() => {
      setItems([])
    }).finally(() => {
      setLoading(false)
    })
  }, [open])

  // Close on Escape key
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      aria-modal="true"
      role="dialog"
      aria-label="Queued items"
    >
      {/* Dimmed backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet — slides up from bottom */}
      <div className="relative z-10 w-full max-h-[70vh] overflow-y-auto rounded-t-2xl bg-glomalin-surface border-t border-glomalin-border">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-glomalin-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-glomalin-border">
          <h2 className="text-sm font-mono font-semibold text-glomalin-text">
            Queued items
          </h2>
          <button
            onClick={onClose}
            className="text-xs font-mono text-glomalin-muted hover:text-glomalin-text transition-colors px-2 py-1 rounded"
            aria-label="Close"
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3">
          {loading ? (
            <p className="text-xs font-mono text-glomalin-muted py-4 text-center">
              Loading…
            </p>
          ) : items.length === 0 ? (
            <p className="text-xs font-mono text-glomalin-muted py-4 text-center">
              No items queued
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((item, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-glomalin-border/50 last:border-0"
                >
                  <span className="text-xs font-mono text-glomalin-text">
                    {item.label}
                  </span>
                  <span className="text-xs font-mono text-glomalin-muted">
                    {item.timestamp}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
