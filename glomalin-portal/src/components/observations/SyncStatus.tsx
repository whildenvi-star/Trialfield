'use client'

interface SyncStatusProps {
  pendingCount: number
  isSyncing: boolean
}

export function SyncStatus({ pendingCount, isSyncing }: SyncStatusProps) {
  if (pendingCount === 0 && !isSyncing) return null

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-glomalin-border bg-glomalin-surface text-glomalin-muted text-sm font-mono">
      {isSyncing ? (
        <>
          <span
            className="inline-block w-3 h-3 rounded-full border-2 border-glomalin-muted border-t-transparent animate-spin"
            aria-hidden="true"
          />
          <span>Syncing...</span>
        </>
      ) : (
        <>
          <span aria-hidden="true">&#9729;</span>
          <span>
            {pendingCount} observation{pendingCount === 1 ? '' : 's'} waiting to sync
          </span>
        </>
      )}
    </div>
  )
}
