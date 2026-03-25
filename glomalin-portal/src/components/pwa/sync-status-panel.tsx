'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  processQueue,
  getQueueSummary,
  getLastSyncTimestamp,
} from '@/lib/offline/sync-engine'
import { offlineQueue } from '@/lib/offline/db'
import type { QueuedOperation } from '@/lib/offline/types'
import type { SyncResult } from '@/lib/offline/sync-engine'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SyncStatusPanelProps {
  open: boolean
  onClose: () => void
  getToken: () => Promise<string | null>
  onSyncComplete?: (result: SyncResult) => void
}

// ─── Relative time helper ─────────────────────────────────────────────────────

function relativeTime(isoString: string): string {
  const now = Date.now()
  const then = new Date(isoString).getTime()
  const diffMs = now - then

  if (diffMs < 0) return 'just now'

  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return 'just now'

  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`

  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`

  const diffDay = Math.floor(diffHr / 24)
  if (diffDay === 1) return 'yesterday'

  return `${diffDay}d ago`
}

// ─── Inline SVG icons ─────────────────────────────────────────────────────────

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

function SmallXIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

function SyncSpinnerIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{
        animation: spinning ? 'spin 1s linear infinite' : undefined,
        display: 'inline-block',
      }}
    >
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SyncStatusPanel({
  open,
  onClose,
  getToken,
  onSyncComplete,
}: SyncStatusPanelProps) {
  const [pending, setPending] = useState<QueuedOperation[]>([])
  const [failed, setFailed] = useState<QueuedOperation[]>([])
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  // Track whether component is mounted to avoid stale setState
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // Load queue summary whenever panel opens
  const refreshSummary = useCallback(async () => {
    try {
      const summary = await getQueueSummary()
      if (!mountedRef.current) return
      setPending(summary.pending)
      setFailed(summary.failed)
      setLastSync(summary.lastSync)
    } catch {
      // IndexedDB unavailable — show empty state
    }
  }, [])

  useEffect(() => {
    if (open) {
      refreshSummary()
    }
  }, [open, refreshSummary])

  // ── Sync Now ────────────────────────────────────────────────────────────────

  async function handleSyncNow() {
    if (syncing) return
    setSyncing(true)
    setSyncError(null)

    try {
      const result = await processQueue(getToken)
      if (!mountedRef.current) return

      // Refresh last sync timestamp
      const ts = await getLastSyncTimestamp()
      if (mountedRef.current) setLastSync(ts)

      onSyncComplete?.(result)
      await refreshSummary()
    } catch (err) {
      if (!mountedRef.current) return
      setSyncError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      if (mountedRef.current) setSyncing(false)
    }
  }

  // ── Retry All failed ────────────────────────────────────────────────────────

  async function handleRetryAll() {
    for (const op of failed) {
      await offlineQueue.update(op.id, { status: 'pending', retryCount: 0, errorMessage: undefined })
    }
    await refreshSummary()
    // Trigger sync
    await handleSyncNow()
  }

  // ── Per-item retry ──────────────────────────────────────────────────────────

  async function handleRetryItem(op: QueuedOperation) {
    await offlineQueue.update(op.id, { status: 'pending', retryCount: 0, errorMessage: undefined })
    await refreshSummary()
    await handleSyncNow()
  }

  // ── Cancel pending item ─────────────────────────────────────────────────────

  async function handleCancelPending(op: QueuedOperation) {
    await offlineQueue.delete(op.id)
    await refreshSummary()
  }

  // ── Label helpers ───────────────────────────────────────────────────────────

  function opLabel(op: QueuedOperation): string {
    const desc = op.description ?? op.passType ?? op.operationType ?? op.type
    const field = op.fieldId ?? 'Unknown field'
    return `${field} — ${desc}`
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const hasPending = pending.length > 0
  const hasFailed = failed.length > 0
  const isEmpty = !hasPending && !hasFailed

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(8,6,4,0.7)',
          zIndex: 50,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.2s ease',
        }}
      />

      {/* Bottom sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sync Status"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 51,
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.2s ease-out',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
          backgroundColor: '#0e0c0b',
          border: '1px solid #2a2218',
          borderBottom: 'none',
          maxHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 16px 12px',
            borderBottom: '1px solid #2a2218',
            flexShrink: 0,
          }}
        >
          <div>
            <h2 style={{ color: '#e8d8c0', fontSize: '16px', fontWeight: 600, margin: 0 }}>
              Sync Status
            </h2>
            <p style={{ color: '#6a5a4a', fontSize: '12px', marginTop: '2px' }}>
              {lastSync ? `Last sync: ${relativeTime(lastSync)}` : 'Never synced'}
            </p>
          </div>

          {/* Sync Now button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleSyncNow}
              disabled={syncing}
              style={{
                backgroundColor: '#C8860A',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: syncing ? 'not-allowed' : 'pointer',
                opacity: syncing ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                minHeight: '36px',
              }}
              aria-label="Sync Now"
            >
              <SyncSpinnerIcon spinning={syncing} />
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>

            <button
              onClick={onClose}
              aria-label="Close sync status panel"
              style={{
                color: '#6a5a4a',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '44px',
                minHeight: '44px',
              }}
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 16px' }}>
          {/* Sync error */}
          {syncError && (
            <div
              style={{
                marginBottom: '12px',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid #8B3A3A',
                backgroundColor: 'rgba(139,58,58,0.15)',
                color: '#fca5a5',
                fontSize: '13px',
              }}
            >
              {syncError}
            </div>
          )}

          {/* Empty state */}
          {isEmpty && !syncError && (
            <p style={{ color: '#6a5a4a', fontSize: '14px', textAlign: 'center', padding: '24px 0' }}>
              No pending or failed items — all synced.
            </p>
          )}

          {/* Pending items */}
          {hasPending && (
            <div style={{ marginBottom: '16px' }}>
              <p style={{ color: '#6a5a4a', fontSize: '12px', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {pending.length} Pending
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {pending.map((op) => (
                  <div
                    key={op.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: '1px solid #2a2218',
                      backgroundColor: 'rgba(200,134,10,0.06)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <span style={{ color: '#C8860A' }}>
                        <ClockIcon />
                      </span>
                      <span
                        style={{
                          color: '#e8d8c0',
                          fontSize: '13px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {opLabel(op)}
                      </span>
                    </div>
                    <button
                      onClick={() => handleCancelPending(op)}
                      aria-label={`Cancel pending: ${opLabel(op)}`}
                      style={{
                        color: '#6a5a4a',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '32px',
                        minHeight: '32px',
                        marginLeft: '8px',
                        flexShrink: 0,
                      }}
                    >
                      <SmallXIcon />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Failed items */}
          {hasFailed && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <p style={{ color: '#6a5a4a', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {failed.length} Failed
                </p>
                <button
                  onClick={handleRetryAll}
                  disabled={syncing}
                  style={{
                    color: '#C8860A',
                    background: 'none',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: syncing ? 'not-allowed' : 'pointer',
                    opacity: syncing ? 0.6 : 1,
                  }}
                >
                  Retry All
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {failed.map((op) => (
                  <div
                    key={op.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: '1px solid #8B3A3A',
                      backgroundColor: 'rgba(139,58,58,0.1)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p
                          style={{
                            color: '#e8d8c0',
                            fontSize: '13px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            marginBottom: '4px',
                          }}
                        >
                          {opLabel(op)}
                        </p>
                        {op.errorMessage && (
                          <p style={{ color: '#fca5a5', fontSize: '12px' }}>
                            {op.errorMessage}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleRetryItem(op)}
                        disabled={syncing}
                        style={{
                          color: '#C8860A',
                          background: 'none',
                          border: '1px solid #C8860A',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: syncing ? 'not-allowed' : 'pointer',
                          padding: '4px 8px',
                          flexShrink: 0,
                          opacity: syncing ? 0.6 : 1,
                        }}
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
