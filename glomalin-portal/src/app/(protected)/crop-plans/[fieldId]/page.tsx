'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/browser'
import OfflineBanner from '@/components/pwa/offline-banner'
import SyncStatusPanel from '@/components/pwa/sync-status-panel'
import {
  syncCropPlanDetail,
  getCachedCropPlan,
  confirmPass,
  addPass,
  editPass,
  fetchOperators,
} from '@/lib/offline/crop-plan-sync'
import { offlineQueue } from '@/lib/offline/db'
import { getLastSyncTimestamp } from '@/lib/offline/sync-engine'
import type { CachedCropPlan } from '@/lib/offline/types'
import type { OperatorRecord } from '@/lib/offline/crop-plan-sync'
import type { SyncResult } from '@/lib/offline/sync-engine'

// ─── relative time helper ─────────────────────────────────────────────────────

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

// ─── agronomic sort order ──────────────────────────────────────────────────────

const OP_SORT_ORDER: Record<string, number> = {
  TILLAGE: 1,
  PLANTING: 2,
  SPRAYING: 3,
  CULTIVATION: 4,
  MOWING: 5,
  HARVEST: 6,
  OTHER: 7,
}

/** Map display type names to sort keys */
function sortKeyForType(type: string): number {
  const upper = type.toUpperCase()
  return OP_SORT_ORDER[upper] ?? OP_SORT_ORDER.OTHER
}

// ─── pass shape used locally (extends CachedCropPlan pass) ────────────────────

interface PassState {
  id: string
  type: string
  passNumber?: number
  status: 'PLANNED' | 'CONFIRMED'
  operationDate?: string
  operatorName?: string
  isUnplanned?: boolean
  fieldOperationId?: string
  fieldEnterpriseId?: string
}

// ─── inline SVG icons ─────────────────────────────────────────────────────────

function ArrowLeftIcon() {
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
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  )
}

function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function CircleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
    </svg>
  )
}

function CheckCircleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="M22 4 12 14.01l-3-3" />
    </svg>
  )
}

function SyncIcon() {
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
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  )
}

function ClockBadgeIcon() {
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

function PlusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function XIcon() {
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

// ─── skeleton ─────────────────────────────────────────────────────────────────

function SkeletonDetail() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-6 w-48 rounded bg-gray-200" />
      <div className="h-4 w-32 rounded bg-gray-100" />
      <div className="mt-6 space-y-2">
        <div className="h-4 w-full rounded bg-gray-100" />
        <div className="h-4 w-3/4 rounded bg-gray-100" />
        <div className="h-4 w-2/3 rounded bg-gray-100" />
      </div>
      <div className="mt-6 space-y-2">
        <div className="h-4 w-full rounded bg-gray-100" />
        <div className="h-4 w-5/6 rounded bg-gray-100" />
      </div>
    </div>
  )
}

// ─── today's date helper ───────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

// ─── bottom sheet backdrop ────────────────────────────────────────────────────

function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(8,6,4,0.7)',
          zIndex: 50,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.2s ease',
        }}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 51,
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.25s ease',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)',
          maxHeight: '90dvh',
          overflowY: 'auto',
          backgroundColor: '#0e0c0b',
          border: '1px solid #2a2218',
        }}
      >
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <h2 className="text-base font-semibold" style={{ color: '#e8d8c0' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded"
            style={{ color: '#6a5a4a' }}
            aria-label="Close"
          >
            <XIcon />
          </button>
        </div>
        <div className="px-4 pb-4">{children}</div>
      </div>
    </>
  )
}

// ─── operator selector ────────────────────────────────────────────────────────

interface OperatorSelectProps {
  operators: OperatorRecord[]
  value: string // certUserId
  onChange: (certUserId: string, fullName: string) => void
}

function OperatorSelect({ operators, value, onChange }: OperatorSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => {
        const op = operators.find((o) => o.certUserId === e.target.value)
        if (op) onChange(op.certUserId, op.fullName)
      }}
      className="w-full rounded border px-3 py-2 text-sm"
      style={{
        backgroundColor: '#080604',
        borderColor: '#2a2218',
        color: '#e8d8c0',
        minHeight: '44px',
      }}
    >
      {operators.map((op) => (
        <option key={op.certUserId} value={op.certUserId}>
          {op.fullName} ({op.role})
        </option>
      ))}
    </select>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function CropPlanDetailPage() {
  const params = useParams()
  const fieldId = typeof params?.fieldId === 'string' ? params.fieldId : ''

  const [plan, setPlan] = useState<CachedCropPlan | null>(null)
  const [passes, setPasses] = useState<PassState[]>([])
  const [operators, setOperators] = useState<OperatorRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toastError, setToastError] = useState<string | null>(null)

  // Auth token stored for write calls
  const tokenRef = useRef<string | null>(null)

  // Current user — certUserId + fullName from operator list matched to session
  const [currentUser, setCurrentUser] = useState<{
    certUserId: string
    fullName: string
    supabaseId: string
  } | null>(null)

  // Undo toast state
  const [undoVisible, setUndoVisible] = useState(false)
  const [undoMessage, setUndoMessage] = useState('')
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingConfirmRef = useRef<{
    passId: string
    passType: string
    operationDate: string
    operatorCertUserId: string
    operatorName: string
    prevPasses: PassState[]
  } | null>(null)

  // Sheets
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [editingPass, setEditingPass] = useState<PassState | null>(null)

  // Add-pass form
  const [addOpType, setAddOpType] = useState('Herbicide')
  const [addDate, setAddDate] = useState(todayISO())
  const [addNotes, setAddNotes] = useState('')
  const [addOperatorCertId, setAddOperatorCertId] = useState('')
  const [addOperatorName, setAddOperatorName] = useState('')
  const [addSubmitting, setAddSubmitting] = useState(false)

  // Edit-pass form
  const [editDate, setEditDate] = useState('')
  const [editOperatorCertId, setEditOperatorCertId] = useState('')

  // Sync panel
  const [showSyncPanel, setShowSyncPanel] = useState(false)
  const [pendingQueueCount, setPendingQueueCount] = useState(0)
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<string | null>(null)
  const [editOperatorName, setEditOperatorName] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)

  // ── helper: show error briefly ──────────────────────────────────────────────

  const showError = useCallback((msg: string) => {
    setToastError(msg)
    setTimeout(() => setToastError(null), 4000)
  }, [])

  // ── refresh queue state (count + pending IDs + last sync timestamp) ──────────

  const refreshQueueState = useCallback(async () => {
    try {
      const ops = await offlineQueue.getPending()
      setPendingQueueCount(ops.length)
      const ts = await getLastSyncTimestamp()
      setLastSyncTimestamp(ts)
    } catch {
      // IndexedDB unavailable — ignore
    }
  }, [])

  // Poll queue state every 10s to keep badge current
  useEffect(() => {
    refreshQueueState()

    const intervalId = setInterval(() => {
      refreshQueueState()
    }, 10000)

    return () => clearInterval(intervalId)
  }, [refreshQueueState])

  // Listen for online event — re-fetch field data after Background Sync fires
  useEffect(() => {
    if (!fieldId) return

    async function handleOnline() {
      // Wait 2s for Background Sync to fire, then re-fetch
      await new Promise((r) => setTimeout(r, 2000))
      await refreshQueueState()
      if (!tokenRef.current) return
      try {
        const refreshedPlan = await syncCropPlanDetail(tokenRef.current, fieldId)
        if (refreshedPlan) {
          setPlan(refreshedPlan)
          setPasses(
            refreshedPlan.passes.map((p) => ({
              id: p.id,
              type: p.type,
              passNumber: p.passNumber,
              status: p.status,
              operationDate: p.operationDate,
              operatorName: p.operatorName,
              isUnplanned: (p as PassState).isUnplanned,
              fieldOperationId: (p as PassState).fieldOperationId,
              fieldEnterpriseId: (p as PassState).fieldEnterpriseId,
            }))
          )
        }
      } catch {
        // Silently ignore — page still shows cached data
      }
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [fieldId, refreshQueueState])

  // ── handle sync complete from SyncStatusPanel ─────────────────────────────

  const handleSyncComplete = useCallback(async (_result: SyncResult) => {
    await refreshQueueState()
    if (!tokenRef.current || !fieldId) return
    try {
      const refreshedPlan = await syncCropPlanDetail(tokenRef.current, fieldId)
      if (refreshedPlan) {
        setPlan(refreshedPlan)
        setPasses(
          refreshedPlan.passes.map((p) => ({
            id: p.id,
            type: p.type,
            passNumber: p.passNumber,
            status: p.status,
            operationDate: p.operationDate,
            operatorName: p.operatorName,
            isUnplanned: (p as PassState).isUnplanned,
            fieldOperationId: (p as PassState).fieldOperationId,
            fieldEnterpriseId: (p as PassState).fieldEnterpriseId,
          }))
        )
      }
    } catch {
      // Silently ignore
    }
  }, [fieldId, refreshQueueState])

  // ── commit pending confirmation immediately (before starting a new one) ──────

  const flushPendingConfirm = useCallback(async () => {
    if (!pendingConfirmRef.current || !undoTimerRef.current) return

    clearTimeout(undoTimerRef.current)
    undoTimerRef.current = null
    setUndoVisible(false)

    const pending = pendingConfirmRef.current
    pendingConfirmRef.current = null

    if (!tokenRef.current) return
    try {
      const result = await confirmPass(
        tokenRef.current,
        fieldId,
        pending.passId,
        pending.passType,
        pending.operationDate,
        pending.operatorCertUserId
      )
      if (result.queued && result.fieldOperationId) {
        setPasses((prev) =>
          prev.map((p) =>
            p.id === pending.passId
              ? { ...p, fieldOperationId: result.fieldOperationId }
              : p
          )
        )
        await refreshQueueState()
      }
    } catch {
      // Revert on failure
      setPasses(pending.prevPasses)
      showError('Failed to confirm pass')
    }
  }, [fieldId, showError, refreshQueueState])

  // ── load plan + operators ───────────────────────────────────────────────────

  useEffect(() => {
    if (!fieldId) return

    async function loadData() {
      setLoading(true)
      setError(null)

      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        const token = user
          ? (await supabase.auth.getSession()).data.session?.access_token ?? null
          : null

        tokenRef.current = token

        // Load plan
        let loadedPlan: CachedCropPlan | null = null
        if (token && navigator.onLine) {
          try {
            loadedPlan = await syncCropPlanDetail(token, fieldId)
          } catch {
            loadedPlan = (await getCachedCropPlan(fieldId)) ?? null
          }
        } else {
          loadedPlan = (await getCachedCropPlan(fieldId)) ?? null
        }

        if (!loadedPlan) {
          setError(navigator.onLine ? 'Unable to load field data.' : 'Field not found in offline cache.')
          return
        }

        setPlan(loadedPlan)
        // Initialize mutable passes array from plan
        setPasses(
          loadedPlan.passes.map((p) => ({
            id: p.id,
            type: p.type,
            passNumber: p.passNumber,
            status: p.status,
            operationDate: p.operationDate,
            operatorName: p.operatorName,
            isUnplanned: (p as PassState).isUnplanned,
            fieldOperationId: (p as PassState).fieldOperationId,
            fieldEnterpriseId: (p as PassState).fieldEnterpriseId,
          }))
        )

        // Load operators (online only — gracefully degrade)
        if (token && navigator.onLine) {
          try {
            const ops = await fetchOperators(token)
            setOperators(ops)

            // Match current user to operator list
            if (user) {
              const matched = ops.find((o) => o.supabaseId === user.id)
              if (matched) {
                setCurrentUser({
                  certUserId: matched.certUserId,
                  fullName: matched.fullName,
                  supabaseId: user.id,
                })
                setAddOperatorCertId(matched.certUserId)
                setAddOperatorName(matched.fullName)
              }
            }
          } catch {
            // Operators unavailable — still show the page
          }
        }
      } catch {
        setError('Unable to load field data.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [fieldId])

  // ── sort passes by agronomic sequence ──────────────────────────────────────

  const sortedPasses = [...passes].sort((a, b) => {
    const aOrder = sortKeyForType(a.type)
    const bOrder = sortKeyForType(b.type)
    if (aOrder !== bOrder) return aOrder - bOrder
    return (a.passNumber ?? 0) - (b.passNumber ?? 0)
  })

  // ── confirm tap handler ─────────────────────────────────────────────────────

  async function handleConfirmTap(pass: PassState) {
    if (!tokenRef.current) {
      showError('Not authenticated')
      return
    }

    const operatorCertId = currentUser?.certUserId ?? ''
    const operatorName = currentUser?.fullName ?? 'Unknown'
    const opDate = todayISO()

    // If there's already a pending confirmation, flush it first
    if (pendingConfirmRef.current) {
      await flushPendingConfirm()
    }

    // Optimistic update
    const prevPasses = passes
    setPasses((prev) =>
      prev.map((p) =>
        p.id === pass.id
          ? { ...p, status: 'CONFIRMED', operationDate: opDate, operatorName }
          : p
      )
    )

    // Store pending confirmation
    pendingConfirmRef.current = {
      passId: pass.id,
      passType: pass.type,
      operationDate: opDate,
      operatorCertUserId: operatorCertId,
      operatorName,
      prevPasses,
    }

    // Show undo toast
    setUndoMessage('Pass confirmed')
    setUndoVisible(true)

    // Auto-commit after 5s
    undoTimerRef.current = setTimeout(async () => {
      undoTimerRef.current = null
      setUndoVisible(false)

      const pending = pendingConfirmRef.current
      pendingConfirmRef.current = null

      if (!pending || !tokenRef.current) return
      try {
        const result = await confirmPass(
          tokenRef.current,
          fieldId,
          pending.passId,
          pending.passType,
          pending.operationDate,
          pending.operatorCertUserId
        )
        // If queued offline, update the pass with the pending fieldOperationId
        if (result.queued && result.fieldOperationId) {
          setPasses((prev) =>
            prev.map((p) =>
              p.id === pending.passId
                ? { ...p, fieldOperationId: result.fieldOperationId }
                : p
            )
          )
          await refreshQueueState()
        }
      } catch {
        setPasses(pending.prevPasses)
        showError('Failed to confirm pass')
      }
    }, 5000)
  }

  // ── cancel pending-sync confirmation ────────────────────────────────────────

  const handleCancelPendingPass = useCallback(async (pass: PassState) => {
    // Find the matching queued operation for this pass and remove it
    try {
      const ops = await offlineQueue.getPending()
      const matchingOp = ops.find(
        (op) =>
          op.fieldId === fieldId &&
          (op.passId === pass.id || op.fieldOperationId === pass.fieldOperationId)
      )
      if (matchingOp) {
        await offlineQueue.delete(matchingOp.id)
      }
    } catch {
      // Ignore IDB errors
    }

    // Revert the pass back to PLANNED in local state
    setPasses((prev) =>
      prev.map((p) =>
        p.id === pass.id
          ? { ...p, status: 'PLANNED', operationDate: undefined, operatorName: undefined, fieldOperationId: undefined }
          : p
      )
    )
    await refreshQueueState()
  }, [fieldId, refreshQueueState])

  // ── undo handler ────────────────────────────────────────────────────────────

  function handleUndo() {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current)
      undoTimerRef.current = null
    }
    setUndoVisible(false)

    const pending = pendingConfirmRef.current
    pendingConfirmRef.current = null

    if (pending) {
      setPasses(pending.prevPasses)
    }
  }

  // ── add pass submit ─────────────────────────────────────────────────────────

  async function handleAddPass(e: React.FormEvent) {
    e.preventDefault()
    if (!tokenRef.current || addSubmitting) return

    setAddSubmitting(true)

    // Optimistic: add a temporary pass to the list
    const tempId = `temp-${Date.now()}`
    const optimisticPass: PassState = {
      id: tempId,
      type: addOpType,
      status: 'CONFIRMED',
      operationDate: addDate,
      operatorName: addOperatorName,
      isUnplanned: true,
    }
    setPasses((prev) => [...prev, optimisticPass])
    setShowAddSheet(false)

    try {
      const result = await addPass(
        tokenRef.current,
        fieldId,
        addOpType,
        addDate,
        addNotes || undefined,
        addOperatorCertId || undefined
      )

      // Replace temp entry with real one
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const serverPass = (result as any).pass as {
        id?: string
        type?: string
        status?: 'PLANNED' | 'CONFIRMED'
        operationDate?: string
        operatorName?: string
      }
      setPasses((prev) =>
        prev.map((p) =>
          p.id === tempId
            ? {
                ...p,
                id: serverPass?.id ?? result.fieldOperationId ?? tempId,
                type: serverPass?.type ?? p.type,
                status: serverPass?.status ?? 'CONFIRMED',
                operationDate: serverPass?.operationDate ?? p.operationDate,
                operatorName: serverPass?.operatorName ?? p.operatorName,
                fieldOperationId: result.fieldOperationId,
              }
            : p
        )
      )
    } catch (err) {
      // Remove optimistic entry
      setPasses((prev) => prev.filter((p) => p.id !== tempId))
      showError(err instanceof Error ? err.message : 'Failed to add pass')
    } finally {
      setAddSubmitting(false)
      // Reset form (keep operator as current user)
      setAddOpType('Herbicide')
      setAddDate(todayISO())
      setAddNotes('')
      if (currentUser) {
        setAddOperatorCertId(currentUser.certUserId)
        setAddOperatorName(currentUser.fullName)
      }
    }
  }

  // ── open edit sheet ─────────────────────────────────────────────────────────

  function handleEditTap(pass: PassState) {
    setEditingPass(pass)
    setEditDate(pass.operationDate ?? todayISO())

    // Pre-fill operator: find current user or fall back to pass's operator
    if (currentUser) {
      setEditOperatorCertId(currentUser.certUserId)
      setEditOperatorName(currentUser.fullName)
    } else {
      // Find in list by name match
      const matched = operators.find((o) => o.fullName === pass.operatorName)
      setEditOperatorCertId(matched?.certUserId ?? '')
      setEditOperatorName(pass.operatorName ?? '')
    }
  }

  // ── edit pass submit ────────────────────────────────────────────────────────

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault()
    if (!tokenRef.current || !editingPass || editSubmitting) return
    if (!editingPass.fieldEnterpriseId) {
      showError('Cannot edit — missing field enterprise ID')
      return
    }

    setEditSubmitting(true)

    const prevPasses = passes
    // Optimistic update
    setPasses((prev) =>
      prev.map((p) =>
        p.id === editingPass.id
          ? { ...p, operationDate: editDate, operatorName: editOperatorName }
          : p
      )
    )
    setEditingPass(null)

    try {
      await editPass(
        tokenRef.current,
        editingPass.fieldOperationId ?? editingPass.id,
        editingPass.fieldEnterpriseId,
        editDate,
        editOperatorCertId || undefined
      )
    } catch (err) {
      setPasses(prevPasses)
      showError(err instanceof Error ? err.message : 'Failed to save edit')
    } finally {
      setEditSubmitting(false)
      // Reset operator to current user
      if (currentUser) {
        setEditOperatorCertId(currentUser.certUserId)
        setEditOperatorName(currentUser.fullName)
      }
    }
  }

  // ── render states ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div>
        <Link
          href="/crop-plans"
          className="mb-4 flex min-h-[48px] min-w-[48px] items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon />
          Back
        </Link>
        <SkeletonDetail />
      </div>
    )
  }

  if (error || !plan) {
    return (
      <div>
        <Link
          href="/crop-plans"
          className="mb-4 flex min-h-[48px] min-w-[48px] items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon />
          Back
        </Link>
        <p className="text-center text-sm text-red-600">{error ?? 'Field not found'}</p>
        <div className="mt-4 text-center">
          <Link href="/crop-plans" className="text-sm underline">
            Return to field list
          </Link>
        </div>
      </div>
    )
  }

  const confirmedCount = passes.filter((p) => p.status === 'CONFIRMED').length
  const totalCount = passes.length

  // ── main render ────────────────────────────────────────────────────────────

  return (
    <div style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
      {/* Back navigation + sync icon */}
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/crop-plans"
          className="flex min-h-[48px] min-w-[48px] items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon />
          Back
        </Link>

        {/* Sync icon with queue count badge */}
        <button
          onClick={() => {
            setShowSyncPanel(true)
          }}
          aria-label={pendingQueueCount > 0 ? `${pendingQueueCount} pending sync` : 'Sync status'}
          style={{
            position: 'relative',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: pendingQueueCount > 0 ? '#C8860A' : '#6a5a4a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '44px',
            minHeight: '44px',
          }}
        >
          <SyncIcon />
          {pendingQueueCount > 0 && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                minWidth: '16px',
                height: '16px',
                borderRadius: '8px',
                backgroundColor: '#C8860A',
                color: '#080604',
                fontSize: '10px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 3px',
              }}
            >
              {pendingQueueCount > 99 ? '99+' : pendingQueueCount}
            </span>
          )}
        </button>
      </div>

      {/* Page title + last updated timestamp */}
      <div className="mb-4">
        <h1 className="text-xl font-bold">{plan.fieldName}</h1>
        <p className="text-sm text-muted-foreground">
          {plan.enterprise}
          {plan.acres > 0 ? ` · ${plan.acres} ac` : ''}
        </p>
        <p style={{ fontSize: '12px', color: '#6a5a4a', marginTop: '4px' }}>
          Last updated: {lastSyncTimestamp ? relativeTime(lastSyncTimestamp) : 'never'}
        </p>
      </div>

      {/* Offline banner */}
      <OfflineBanner />

      {/* ── Crop Info ─────────────────────────────────────────────────────────── */}
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex items-baseline gap-2">
          <span className="text-sm text-muted-foreground">Crop</span>
          <span className="text-lg font-semibold">{plan.crop}</span>
        </div>
        <dl className="space-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Variety:</dt>
            <dd>{plan.variety ?? <span className="italic text-muted-foreground">Not specified</span>}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Population:</dt>
            <dd>
              <span className="italic text-muted-foreground">Not specified</span>
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Seed Treatment:</dt>
            <dd>
              <span className="italic text-muted-foreground">None</span>
            </dd>
          </div>
        </dl>
      </div>

      {/* ── Inputs ───────────────────────────────────────────────────────────── */}
      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">Inputs</h2>
        {plan.inputs.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">No inputs planned</p>
        ) : (
          <div className="divide-y rounded-lg border bg-card">
            {plan.inputs.map((input, i) => {
              const rateNum = parseFloat(input.rate)
              const total =
                !isNaN(rateNum) && plan.acres > 0
                  ? (rateNum * plan.acres).toFixed(1)
                  : null

              return (
                <div key={i} className="flex items-start justify-between p-4">
                  <div>
                    <p className="font-medium">{input.product}</p>
                    {total && (
                      <p className="text-xs text-muted-foreground">
                        Total: {total} {input.unit}
                      </p>
                    )}
                  </div>
                  <p className="ml-4 shrink-0 text-sm text-muted-foreground">
                    {input.rate} {input.unit}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Passes ───────────────────────────────────────────────────────────── */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Passes</h2>
          {totalCount > 0 && (
            <span className="text-sm text-muted-foreground">
              {confirmedCount} of {totalCount} complete
            </span>
          )}
        </div>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div
            className="mb-4 h-2 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: '#2a2218' }}
            role="progressbar"
            aria-valuenow={confirmedCount}
            aria-valuemin={0}
            aria-valuemax={totalCount}
            aria-label={`${confirmedCount} of ${totalCount} passes complete`}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${totalCount > 0 ? (confirmedCount / totalCount) * 100 : 0}%`,
                backgroundColor: '#C8860A',
              }}
            />
          </div>
        )}

        {sortedPasses.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">No passes planned</p>
        ) : (
          <div className="divide-y rounded-lg border bg-card">
            {sortedPasses.map((pass, i) => {
              const isConfirmed = pass.status === 'CONFIRMED'
              // A pass is "pending sync" if its fieldOperationId starts with 'pending-'
              const isPendingSync = isConfirmed && pass.fieldOperationId?.startsWith('pending-')
              // Non-pending confirmed passes are editable
              const isEditable = isConfirmed && !isPendingSync
              return (
                <div
                  key={pass.id ?? i}
                  className="flex min-h-[64px] items-center gap-3 p-4"
                  style={{ cursor: isEditable ? 'pointer' : 'default' }}
                  onClick={() => isEditable && handleEditTap(pass)}
                  role={isEditable ? 'button' : undefined}
                  tabIndex={isEditable ? 0 : undefined}
                  onKeyDown={
                    isEditable
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            handleEditTap(pass)
                          }
                        }
                      : undefined
                  }
                  aria-label={
                    isEditable
                      ? `${pass.type} pass confirmed — tap to edit`
                      : undefined
                  }
                >
                  {/* Checkbox tap target */}
                  <button
                    onClick={(e) => {
                      if (!isConfirmed) {
                        e.stopPropagation()
                        handleConfirmTap(pass)
                      }
                    }}
                    disabled={isConfirmed}
                    className="flex min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-full"
                    style={{
                      color: isConfirmed ? (isPendingSync ? '#C8860A' : '#7A9E7E') : '#6a5a4a',
                      cursor: isConfirmed ? 'default' : 'pointer',
                    }}
                    aria-label={isConfirmed ? `${pass.type} confirmed` : `Confirm ${pass.type} pass`}
                    aria-pressed={isConfirmed}
                  >
                    {isConfirmed ? <CheckCircleIcon /> : <CircleIcon />}
                  </button>

                  {/* Pass info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{pass.type}</p>
                      {pass.isUnplanned && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                          Unplanned
                        </span>
                      )}
                      {isPendingSync && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{ backgroundColor: 'rgba(200,134,10,0.15)', color: '#C8860A' }}
                        >
                          <ClockBadgeIcon />
                          Pending sync
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Pass #{pass.passNumber ?? i + 1}
                    </p>
                    {isConfirmed && (pass.operationDate || pass.operatorName) && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {pass.operationDate}
                        {pass.operationDate && pass.operatorName ? ' · ' : ''}
                        {pass.operatorName}
                      </p>
                    )}
                  </div>

                  {/* Status badge / cancel pending */}
                  <div className="ml-2 flex shrink-0 items-center gap-2">
                    {isPendingSync ? (
                      <>
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                          style={{ backgroundColor: 'rgba(200,134,10,0.15)', color: '#C8860A' }}
                        >
                          <CheckIcon />
                          Confirmed
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCancelPendingPass(pass)
                          }}
                          aria-label={`Cancel pending sync for ${pass.type} pass`}
                          title="Cancel pending sync"
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
                          }}
                        >
                          <XIcon />
                        </button>
                      </>
                    ) : isConfirmed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">
                        <CheckIcon />
                        Confirmed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                        Planned
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Floating Action Button ────────────────────────────────────────────── */}
      <button
        onClick={() => {
          setAddDate(todayISO())
          if (currentUser) {
            setAddOperatorCertId(currentUser.certUserId)
            setAddOperatorName(currentUser.fullName)
          }
          setShowAddSheet(true)
        }}
        aria-label="Add unplanned pass"
        style={{
          position: 'fixed',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
          right: '16px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#C8860A',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          zIndex: 40,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <PlusIcon />
      </button>

      {/* ── Undo Toast ────────────────────────────────────────────────────────── */}
      {/* Inline implementation — no external library */}
      <div
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)',
          left: '50%',
          transform: `translateX(-50%) translateY(${undoVisible ? '0' : '24px'})`,
          opacity: undoVisible ? 1 : 0,
          transition: 'opacity 0.2s ease, transform 0.2s ease',
          pointerEvents: undoVisible ? 'auto' : 'none',
          zIndex: 60,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: '#2a2218',
          borderRadius: '8px',
          padding: '12px 16px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          minWidth: '220px',
        }}
      >
        <span className="text-sm" style={{ color: '#e8d8c0' }}>
          {undoMessage}
        </span>
        <button
          onClick={handleUndo}
          className="rounded px-2 py-1 text-sm font-semibold"
          style={{ color: '#C8860A' }}
          aria-label="Undo confirmation"
        >
          Undo
        </button>
      </div>

      {/* Error toast */}
      {toastError && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 61,
            backgroundColor: '#7f1d1d',
            color: '#fca5a5',
            borderRadius: '8px',
            padding: '12px 16px',
            fontSize: '14px',
            maxWidth: '320px',
            textAlign: 'center',
          }}
        >
          {toastError}
        </div>
      )}

      {/* ── Add Pass Bottom Sheet ─────────────────────────────────────────────── */}
      <BottomSheet
        open={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        title="Add Unplanned Pass"
      >
        <form onSubmit={handleAddPass} className="space-y-4">
          <div>
            <p className="mb-1 text-xs" style={{ color: '#6a5a4a' }}>
              Field
            </p>
            <p className="text-sm font-medium" style={{ color: '#e8d8c0' }}>
              {plan.fieldName}
            </p>
          </div>

          <div>
            <label
              htmlFor="add-op-type"
              className="mb-1 block text-xs"
              style={{ color: '#6a5a4a' }}
            >
              Operation Type
            </label>
            <select
              id="add-op-type"
              value={addOpType}
              onChange={(e) => setAddOpType(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
              style={{
                backgroundColor: '#080604',
                borderColor: '#2a2218',
                color: '#e8d8c0',
                minHeight: '44px',
              }}
            >
              <option value="Tillage">Tillage</option>
              <option value="Planting">Planting</option>
              <option value="Herbicide">Herbicide</option>
              <option value="Fertilizer">Fertilizer</option>
              <option value="Harvest">Harvest</option>
              <option value="Scouting">Scouting</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="add-date"
              className="mb-1 block text-xs"
              style={{ color: '#6a5a4a' }}
            >
              Date
            </label>
            <input
              id="add-date"
              type="date"
              value={addDate}
              onChange={(e) => setAddDate(e.target.value)}
              required
              className="w-full rounded border px-3 py-2 text-sm"
              style={{
                backgroundColor: '#080604',
                borderColor: '#2a2218',
                color: '#e8d8c0',
                minHeight: '44px',
              }}
            />
          </div>

          {operators.length > 0 && (
            <div>
              <label className="mb-1 block text-xs" style={{ color: '#6a5a4a' }}>
                Operator
              </label>
              <OperatorSelect
                operators={operators}
                value={addOperatorCertId}
                onChange={(certId, name) => {
                  setAddOperatorCertId(certId)
                  setAddOperatorName(name)
                }}
              />
            </div>
          )}

          <div>
            <label
              htmlFor="add-notes"
              className="mb-1 block text-xs"
              style={{ color: '#6a5a4a' }}
            >
              Notes (optional)
            </label>
            <input
              id="add-notes"
              type="text"
              value={addNotes}
              onChange={(e) => setAddNotes(e.target.value)}
              placeholder="e.g. Test spray"
              className="w-full rounded border px-3 py-2 text-sm"
              style={{
                backgroundColor: '#080604',
                borderColor: '#2a2218',
                color: '#e8d8c0',
                minHeight: '44px',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={addSubmitting}
            className="w-full rounded py-3 text-sm font-semibold"
            style={{
              backgroundColor: '#C8860A',
              color: '#ffffff',
              opacity: addSubmitting ? 0.6 : 1,
              minHeight: '48px',
            }}
          >
            {addSubmitting ? 'Adding...' : 'Add Pass'}
          </button>
        </form>
      </BottomSheet>

      {/* ── Edit Pass Bottom Sheet ────────────────────────────────────────────── */}
      <BottomSheet
        open={editingPass !== null}
        onClose={() => setEditingPass(null)}
        title="Edit Confirmed Pass"
      >
        {editingPass && (
          <form onSubmit={handleEditSave} className="space-y-4">
            <div>
              <p className="mb-1 text-xs" style={{ color: '#6a5a4a' }}>
                Operation Type
              </p>
              <p className="text-sm font-medium" style={{ color: '#e8d8c0' }}>
                {editingPass.type}
              </p>
            </div>

            <div>
              <label
                htmlFor="edit-date"
                className="mb-1 block text-xs"
                style={{ color: '#6a5a4a' }}
              >
                Date
              </label>
              <input
                id="edit-date"
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                required
                className="w-full rounded border px-3 py-2 text-sm"
                style={{
                  backgroundColor: '#080604',
                  borderColor: '#2a2218',
                  color: '#e8d8c0',
                  minHeight: '44px',
                }}
              />
            </div>

            {operators.length > 0 && (
              <div>
                <label className="mb-1 block text-xs" style={{ color: '#6a5a4a' }}>
                  Operator
                </label>
                <OperatorSelect
                  operators={operators}
                  value={editOperatorCertId}
                  onChange={(certId, name) => {
                    setEditOperatorCertId(certId)
                    setEditOperatorName(name)
                  }}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={editSubmitting}
              className="w-full rounded py-3 text-sm font-semibold"
              style={{
                backgroundColor: '#C8860A',
                color: '#ffffff',
                opacity: editSubmitting ? 0.6 : 1,
                minHeight: '48px',
              }}
            >
              {editSubmitting ? 'Saving...' : 'Save'}
            </button>
          </form>
        )}
      </BottomSheet>

      {/* ── Sync Status Panel ─────────────────────────────────────────────────── */}
      <SyncStatusPanel
        open={showSyncPanel}
        onClose={() => setShowSyncPanel(false)}
        getToken={async () => tokenRef.current}
        onSyncComplete={handleSyncComplete}
      />
    </div>
  )
}
