'use client'

import { useEffect, useState } from 'react'
import { getDb } from '@/lib/offline/db'
import type { ConflictRecord } from '@/lib/offline/types'

function typeLabel(type: ConflictRecord['type']): string {
  switch (type) {
    case 'confirm-pass': return 'Confirm Pass'
    case 'add-pass':     return 'Add Pass'
    case 'observation':  return 'Field Observation'
    default:             return 'Field Operation'
  }
}

async function loadUnresolved(): Promise<ConflictRecord[]> {
  try {
    const db = await getDb()
    return db.getAllFromIndex('conflicts', 'by-resolved', 0)
  } catch {
    return []
  }
}

async function markResolved(conflict: ConflictRecord): Promise<void> {
  try {
    const db = await getDb()
    await db.put('conflicts', { ...conflict, resolved: 1 })
  } catch {
    // Non-fatal — UI still removes from list
  }
}

export function ConflictDrawer() {
  const [open, setOpen] = useState(false)
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([])

  // Open on sync:conflicts event and load unresolved records
  useEffect(() => {
    async function handleConflicts() {
      const unresolved = await loadUnresolved()
      if (unresolved.length > 0) {
        setConflicts(unresolved)
        setOpen(true)
      }
    }
    window.addEventListener('sync:conflicts', handleConflicts)
    return () => window.removeEventListener('sync:conflicts', handleConflicts)
  }, [])

  // Auto-close when all conflicts resolved
  useEffect(() => {
    if (open && conflicts.length === 0) setOpen(false)
  }, [open, conflicts.length])

  async function resolve(conflict: ConflictRecord) {
    await markResolved(conflict)
    setConflicts((prev) => prev.filter((c) => c.id !== conflict.id))
  }

  if (!open || conflicts.length === 0) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      aria-modal="true"
      role="dialog"
      aria-label="Sync conflicts"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div className="relative z-10 w-full max-h-[80vh] overflow-y-auto rounded-t-2xl bg-glomalin-surface border-t border-glomalin-border">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-glomalin-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-glomalin-border">
          <h2 className="text-sm font-mono font-semibold text-glomalin-text">
            Sync conflicts ({conflicts.length})
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="text-xs font-mono text-glomalin-muted hover:text-glomalin-text transition-colors px-2 py-1 rounded"
            aria-label="Close"
          >
            Close
          </button>
        </div>

        {/* Conflict list */}
        <div className="px-4 py-3 space-y-4">
          {conflicts.map((conflict) => (
            <div key={conflict.id} className="border border-glomalin-border rounded-lg p-3 space-y-3">
              {/* Conflict metadata */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-glomalin-text">
                  {typeLabel(conflict.type)}
                </span>
                <span className="text-xs font-mono text-glomalin-muted">
                  {new Date(conflict.operationDate).toLocaleDateString()}
                </span>
              </div>
              {conflict.fieldId && (
                <p className="text-xs font-mono text-glomalin-muted">Field: {conflict.fieldId}</p>
              )}

              {/* Your version */}
              <div>
                <p className="text-xs font-mono font-semibold text-glomalin-text mb-1">Your version</p>
                <pre className="text-xs font-mono text-glomalin-muted bg-glomalin-bg rounded p-2 max-h-24 overflow-y-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(conflict.localPayload, null, 2)}
                </pre>
              </div>

              {/* Server version */}
              <div>
                <p className="text-xs font-mono font-semibold text-glomalin-text mb-1">Server version</p>
                <pre className="text-xs font-mono text-glomalin-muted bg-glomalin-bg rounded p-2 max-h-24 overflow-y-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(conflict.serverPayload, null, 2)}
                </pre>
              </div>

              {/* Resolution buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => resolve(conflict)}
                  className="flex-1 text-xs font-mono py-2 rounded border border-glomalin-border text-glomalin-text hover:bg-glomalin-bg transition-colors"
                >
                  Keep mine
                </button>
                <button
                  onClick={() => resolve(conflict)}
                  className="flex-1 text-xs font-mono py-2 rounded border border-glomalin-border text-glomalin-text hover:bg-glomalin-bg transition-colors"
                >
                  Keep server version
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
