'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Claim } from './claim-card'
import { STAGE_ORDER, STAGE_LABELS } from '@/lib/claims/calc'

// Timeline event shape returned by GET /api/claims/[id]/timeline
export interface TimelineEvent {
  id?: string
  claim_id?: string
  event_type: string
  note?: string | null
  event_data?: Record<string, unknown> | null
  actor_id?: string | null
  created_at: string
  // Optimistic entries may not have an id yet
  _optimistic?: boolean
}

// Document shape returned by GET /api/claims/[id]/documents
export interface ClaimDocument {
  id: string
  claim_id: string
  filename: string
  file_size: number
  mime_type: string
  storage_path: string
  category: string
  created_at: string
  signedUrl: string | null
}

interface ClaimDrawerProps {
  open: boolean
  claim: Claim | null
  onClose: () => void
  onClaimUpdated: (updated: Claim) => void
}

type ActiveTab = 'timeline' | 'documents' | 'financials'

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffHours < 1) {
    const mins = Math.floor(diffMs / (1000 * 60))
    return mins <= 1 ? 'just now' : `${mins}m ago`
  }
  if (diffHours < 24) {
    return `${Math.floor(diffHours)}h ago`
  }
  if (diffDays < 7) {
    return `${Math.floor(diffDays)}d ago`
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * ClaimDrawer — slide-over panel for claim detail.
 * Shows header (crop, stage dropdown, date/cause of loss) + 3 tabs: Timeline, Documents, Financials.
 * Follows PolicyDrawer pattern (Phase 30) for consistent slide-over interaction.
 */
export function ClaimDrawer({ open, claim, onClose, onClaimUpdated }: ClaimDrawerProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('timeline')
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [documents, setDocuments] = useState<ClaimDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [stageUpdating, setStageUpdating] = useState(false)

  // Fetch timeline and documents when drawer opens or claim changes
  const fetchData = useCallback(async (claimId: string) => {
    setLoading(true)
    setTimeline([])
    setDocuments([])
    try {
      const [timelineRes, documentsRes] = await Promise.all([
        fetch(`/api/claims/${claimId}/timeline`).then((r) => r.json()),
        fetch(`/api/claims/${claimId}/documents`).then((r) => r.json()),
      ])
      setTimeline(timelineRes.events ?? [])
      setDocuments(documentsRes.documents ?? [])
    } catch {
      // Non-fatal — leave empty arrays; user can see claim header/financials
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && claim) {
      fetchData(claim.id)
      setActiveTab('timeline')
    }
  }, [open, claim, fetchData])

  async function handleStageChange(newStage: string) {
    if (!claim || stageUpdating) return
    setStageUpdating(true)
    try {
      const res = await fetch(`/api/claims/${claim.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      })
      if (res.ok) {
        const { claim: updated } = await res.json()
        onClaimUpdated(updated)
        // Optimistically add stage_change event to timeline
        const stageEvent: TimelineEvent = {
          event_type: 'stage_change',
          event_data: { from: claim.stage, to: newStage },
          created_at: new Date().toISOString(),
          _optimistic: true,
        }
        setTimeline((prev) => [...prev, stageEvent])
      }
    } catch {
      // Failure: no revert needed here — parent workspace handles its own optimism
    } finally {
      setStageUpdating(false)
    }
  }

  async function refetchDocuments() {
    if (!claim) return
    try {
      const res = await fetch(`/api/claims/${claim.id}/documents`)
      const json = await res.json()
      setDocuments(json.documents ?? [])
    } catch {
      // Non-fatal
    }
  }

  const tabButtonClass = (tab: ActiveTab) =>
    [
      'px-4 py-2 text-xs font-mono font-semibold transition-colors border-b-2',
      activeTab === tab
        ? 'border-b-[#C8860A] text-[#C8860A]'
        : 'border-b-transparent text-[#6a5a4a] hover:text-[#e8d8c0]',
    ].join(' ')

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Slide-over panel */}
      <div
        className={[
          'fixed inset-y-0 right-0 z-50 w-full sm:w-[520px]',
          'bg-[#0e0c0b] border-l border-[#2a2218]',
          'flex flex-col transition-transform duration-200',
          open ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#2a2218] flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="font-mono font-bold text-lg text-[#e8d8c0] truncate">
                {claim?.crop ?? '—'}
              </h2>
              <div className="mt-0.5 text-xs text-[#6a5a4a] font-mono space-y-0.5">
                {claim?.date_of_loss && (
                  <p>
                    Date of Loss:{' '}
                    <span className="text-[#e8d8c0]">
                      {new Date(claim.date_of_loss).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </p>
                )}
                {claim?.cause_of_loss && (
                  <p>
                    Cause of Loss:{' '}
                    <span className="text-[#e8d8c0]">{claim.cause_of_loss}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="text-[#6a5a4a] hover:text-[#e8d8c0] transition-colors font-mono text-xl leading-none flex-shrink-0 mt-0.5"
              aria-label="Close drawer"
            >
              ×
            </button>
          </div>

          {/* Stage dropdown */}
          <div className="mt-3">
            <label className="block text-xs text-[#6a5a4a] font-mono mb-1">Stage</label>
            <select
              value={claim?.stage ?? ''}
              onChange={(e) => handleStageChange(e.target.value)}
              disabled={stageUpdating || !claim}
              className="w-full bg-[#080604] border border-[#2a2218] text-[#e8d8c0] font-mono text-sm rounded px-2 py-1.5 focus:outline-none focus:border-[#C8860A] transition-colors disabled:opacity-50"
            >
              {STAGE_ORDER.map((stage) => (
                <option key={stage} value={stage}>
                  {STAGE_LABELS[stage]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-[#2a2218] flex-shrink-0">
          <button className={tabButtonClass('timeline')} onClick={() => setActiveTab('timeline')}>
            Timeline
          </button>
          <button
            className={tabButtonClass('documents')}
            onClick={() => setActiveTab('documents')}
          >
            Documents
          </button>
          <button
            className={tabButtonClass('financials')}
            onClick={() => setActiveTab('financials')}
          >
            Financials
          </button>
        </div>

        {/* Tab content — flex-1 scrollable */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Loading state */}
          {loading && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-[#6a5a4a] font-mono text-xs">Loading...</p>
            </div>
          )}

          {!loading && (
            <>
              {/* Timeline tab */}
              {activeTab === 'timeline' && (
                <TimelineTabContent
                  claimId={claim?.id ?? ''}
                  timeline={timeline}
                  setTimeline={setTimeline}
                  onSwitchTab={() => setActiveTab('documents')}
                />
              )}

              {/* Documents tab */}
              {activeTab === 'documents' && (
                <DocumentsTabContent
                  claimId={claim?.id ?? ''}
                  documents={documents}
                  onUploadComplete={refetchDocuments}
                />
              )}

              {/* Financials tab */}
              {activeTab === 'financials' && (
                <FinancialsTabContent claim={claim} />
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Financials tab (inline — no extra file needed, read-only from claim object)
// ---------------------------------------------------------------------------

function FinancialsTabContent({ claim }: { claim: Claim | null }) {
  if (!claim) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[#6a5a4a] font-mono text-xs">No claim selected.</p>
      </div>
    )
  }

  const rows: { label: string; value: string }[] = [
    {
      label: 'Effective Guarantee',
      value: formatCurrency(claim.effective_guarantee),
    },
    {
      label: 'Estimated Loss (bu)',
      value: claim.estimated_loss_bu != null ? String(claim.estimated_loss_bu) : '—',
    },
    {
      label: 'Appraised Value',
      value: formatCurrency(claim.appraised_value),
    },
    {
      label: 'Indemnity Payment',
      value: claim.indemnity_amount != null ? formatCurrency(claim.indemnity_amount) : 'Pending',
    },
    {
      label: 'Deductible',
      value: claim.deductible_amount != null ? formatCurrency(claim.deductible_amount) : '—',
    },
  ]

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4">
      <p className="text-xs text-[#C8860A] font-mono font-semibold uppercase tracking-wide mb-4">
        Financial Summary
      </p>
      <div className="font-mono">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex justify-between py-2 border-b border-[#2a2218]"
          >
            <span className="text-[#6a5a4a] text-xs">{row.label}</span>
            <span className="text-[#e8d8c0] text-xs">{row.value}</span>
          </div>
        ))}
      </div>
      {claim.adjuster_name && (
        <div className="mt-4 pt-4 border-t border-[#2a2218]">
          <p className="text-xs text-[#C8860A] font-mono font-semibold uppercase tracking-wide mb-3">
            Adjuster
          </p>
          <div className="flex justify-between py-2 border-b border-[#2a2218]">
            <span className="text-[#6a5a4a] text-xs font-mono">Name</span>
            <span className="text-[#e8d8c0] text-xs font-mono">{claim.adjuster_name}</span>
          </div>
          {claim.adjuster_phone && (
            <div className="flex justify-between py-2 border-b border-[#2a2218]">
              <span className="text-[#6a5a4a] text-xs font-mono">Phone</span>
              <span className="text-[#e8d8c0] text-xs font-mono">{claim.adjuster_phone}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Timeline tab content (inline — delegates to TimelineFeed imported component)
// ---------------------------------------------------------------------------

interface TimelineTabContentProps {
  claimId: string
  timeline: TimelineEvent[]
  setTimeline: React.Dispatch<React.SetStateAction<TimelineEvent[]>>
  onSwitchTab: () => void
}

function TimelineTabContent({
  claimId,
  timeline,
  setTimeline,
  onSwitchTab,
}: TimelineTabContentProps) {
  return (
    <TimelineFeedInline
      claimId={claimId}
      timeline={timeline}
      setTimeline={setTimeline}
      onSwitchTab={onSwitchTab}
    />
  )
}

// ---------------------------------------------------------------------------
// Documents tab content (inline — delegates to DocumentUploadInline)
// ---------------------------------------------------------------------------

interface DocumentsTabContentProps {
  claimId: string
  documents: ClaimDocument[]
  onUploadComplete: () => Promise<void>
}

function DocumentsTabContent({ claimId, documents, onUploadComplete }: DocumentsTabContentProps) {
  return (
    <DocumentUploadInline
      claimId={claimId}
      documents={documents}
      onUploadComplete={onUploadComplete}
    />
  )
}

// ---------------------------------------------------------------------------
// TimelineFeed — inline (also exported as TimelineFeed from timeline-feed.tsx)
// ---------------------------------------------------------------------------

interface TimelineFeedInlineProps {
  claimId: string
  timeline: TimelineEvent[]
  setTimeline: React.Dispatch<React.SetStateAction<TimelineEvent[]>>
  onSwitchTab?: () => void
}

function TimelineFeedInline({
  claimId,
  timeline,
  setTimeline,
  onSwitchTab,
}: TimelineFeedInlineProps) {
  const [noteText, setNoteText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [noteError, setNoteError] = useState<string | null>(null)

  async function handleAddNote(text: string) {
    const trimmed = text.trim()
    if (!trimmed || !claimId) return

    setSubmitting(true)
    setNoteError(null)

    // Optimistic append
    const optimisticEntry: TimelineEvent = {
      event_type: 'note',
      note: trimmed,
      created_at: new Date().toISOString(),
      _optimistic: true,
    }
    setTimeline((prev) => [...prev, optimisticEntry])
    setNoteText('')

    try {
      const res = await fetch(`/api/claims/${claimId}/timeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: 'note', note: trimmed }),
      })

      if (!res.ok) {
        throw new Error('Failed to save note')
      }

      const { event } = await res.json()

      // Replace optimistic entry with server-returned event
      setTimeline((prev) => {
        const idx = prev.findLastIndex((e) => e._optimistic && e.event_type === 'note')
        if (idx === -1) return [...prev, event]
        const next = [...prev]
        next[idx] = event
        return next
      })
    } catch {
      // Remove optimistic entry and show error
      setTimeline((prev) => {
        const idx = prev.findLastIndex((e) => e._optimistic && e.event_type === 'note')
        if (idx === -1) return prev
        return prev.filter((_, i) => i !== idx)
      })
      setNoteError('Failed to save note. Please try again.')
      setNoteText(trimmed)
    } finally {
      setSubmitting(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAddNote(noteText)
    }
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Timeline feed — scrollable */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {timeline.length === 0 && (
          <p className="text-[#6a5a4a] font-mono text-xs">No events yet.</p>
        )}
        {timeline.map((event, idx) => (
          <TimelineEventRow
            key={event.id ?? `optimistic-${idx}`}
            event={event}
            onSwitchToDocuments={onSwitchTab}
          />
        ))}
      </div>

      {/* Inline note input — always visible at bottom */}
      <div className="border-t border-[#2a2218] px-5 py-4 flex-shrink-0">
        {noteError && (
          <p className="text-red-400 text-xs font-mono mb-2">{noteError}</p>
        )}
        <textarea
          className="w-full rounded border border-[#2a2218] bg-[#080604] text-[#e8d8c0] text-xs font-mono p-2 resize-none focus:outline-none focus:border-[#C8860A] transition-colors placeholder:text-[#6a5a4a]"
          rows={3}
          placeholder="Add a note... (Enter to submit, Shift+Enter for new line)"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={submitting}
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={() => handleAddNote(noteText)}
            disabled={submitting || !noteText.trim()}
            className="text-xs bg-[#C8860A] text-[#080604] rounded px-3 py-1 font-mono font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {submitting ? 'Saving...' : 'Add Note'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Individual timeline event row
// ---------------------------------------------------------------------------

interface TimelineEventRowProps {
  event: TimelineEvent
  onSwitchToDocuments?: () => void
}

function TimelineEventRow({ event, onSwitchToDocuments }: TimelineEventRowProps) {
  const timestamp = formatDate(event.created_at)

  // User note — accent left border, accent color
  if (event.event_type === 'note') {
    return (
      <div className="border-l-2 border-l-[#C8860A] pl-3">
        <p className="text-[#e8d8c0] text-xs font-mono leading-relaxed">{event.note}</p>
        <p className="text-[#6a5a4a] text-xs font-mono mt-0.5">{timestamp}</p>
      </div>
    )
  }

  // System events — muted gray styling
  let systemText = ''
  switch (event.event_type) {
    case 'stage_change': {
      const from = event.event_data?.from as string | undefined
      const to = event.event_data?.to as string | undefined
      const fromLabel = from ? (STAGE_LABELS[from] ?? from) : '?'
      const toLabel = to ? (STAGE_LABELS[to] ?? to) : '?'
      systemText = `Stage changed: ${fromLabel} → ${toLabel}`
      break
    }
    case 'doc_upload': {
      const filename = event.event_data?.filename as string | undefined
      const docText = filename ? `Document uploaded: ${filename}` : 'Document uploaded'
      return (
        <div className="flex items-start gap-2">
          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#6a5a4a] flex-shrink-0" />
          <div>
            <p className="text-[#6a5a4a] text-xs font-mono">
              {docText}
              {onSwitchToDocuments && (
                <>
                  {' '}
                  <button
                    onClick={onSwitchToDocuments}
                    className="text-[#C8860A] underline underline-offset-2 hover:opacity-80 transition-opacity"
                  >
                    View
                  </button>
                </>
              )}
            </p>
            <p className="text-[#6a5a4a] text-xs font-mono opacity-60 mt-0.5">{timestamp}</p>
          </div>
        </div>
      )
    }
    case 'financial_update':
      systemText = 'Financial details updated'
      break
    case 'adjuster_assigned': {
      const name = event.event_data?.name as string | undefined
      systemText = name ? `Adjuster assigned: ${name}` : 'Adjuster assigned'
      break
    }
    case 'created':
      systemText = 'Claim created'
      break
    case 'deadline_change':
      systemText = 'Deadline updated'
      break
    default:
      systemText = event.event_type.replace(/_/g, ' ')
  }

  return (
    <div className="flex items-start gap-2">
      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#6a5a4a] flex-shrink-0" />
      <div>
        <p className="text-[#6a5a4a] text-xs font-mono">{systemText}</p>
        <p className="text-[#6a5a4a] text-xs font-mono opacity-60 mt-0.5">{timestamp}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DocumentUpload — inline (also exported from document-upload.tsx)
// ---------------------------------------------------------------------------

const MAX_SIZE_BYTES = 25 * 1024 * 1024 // 25MB

interface DocumentUploadInlineProps {
  claimId: string
  documents: ClaimDocument[]
  onUploadComplete: () => Promise<void>
}

function DocumentUploadInline({
  claimId,
  documents,
  onUploadComplete,
}: DocumentUploadInlineProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  async function uploadFile(file: File) {
    // Client-side size guard
    if (file.size > MAX_SIZE_BYTES) {
      setUploadError(`File too large. Maximum size is 25MB.`)
      return
    }

    setUploading(true)
    setUploadError(null)

    try {
      // Step 1: Get signed upload URL from server
      const urlRes = await fetch(`/api/claims/${claimId}/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, mimeType: file.type }),
      })
      if (!urlRes.ok) {
        const err = await urlRes.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to get upload URL')
      }
      const { path, token } = await urlRes.json()

      // Step 2: Upload file bytes directly to Supabase Storage via signed URL
      // Import browser client for Storage upload
      const { createClient } = await import('@/lib/supabase/browser')
      const supabase = createClient()
      const { error: storageError } = await supabase.storage
        .from('claim-documents')
        .uploadToSignedUrl(path, token, file, { contentType: file.type })
      if (storageError) {
        throw new Error(storageError.message ?? 'Storage upload failed')
      }

      // Step 3: Save document metadata to server
      const metaRes = await fetch(`/api/claims/${claimId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storagePath: path,
          filename: file.name,
          fileSize: file.size,
          mimeType: file.type,
        }),
      })
      if (!metaRes.ok) {
        const err = await metaRes.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to save document metadata')
      }

      // Refresh document list
      await onUploadComplete()
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragActive(true)
  }

  function handleDragLeave() {
    setDragActive(false)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    // Reset input so same file can be re-selected after error
    e.target.value = ''
  }

  return (
    <div className="flex-1 overflow-y-auto flex flex-col px-5 py-4">
      {/* Document list */}
      {documents.length === 0 ? (
        <p className="text-[#6a5a4a] font-mono text-xs mb-6">No documents uploaded yet.</p>
      ) : (
        <div className="mb-6 space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between py-2 border-b border-[#2a2218]"
            >
              <div className="flex-1 min-w-0">
                {doc.signedUrl ? (
                  <a
                    href={doc.signedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#C8860A] font-mono text-xs underline underline-offset-2 hover:opacity-80 transition-opacity truncate block"
                  >
                    {doc.filename}
                  </a>
                ) : (
                  <p className="text-[#e8d8c0] font-mono text-xs truncate">{doc.filename}</p>
                )}
                <p className="text-[#6a5a4a] font-mono text-xs mt-0.5">
                  {formatFileSize(doc.file_size)} ·{' '}
                  {new Date(doc.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={[
          'border-2 border-dashed rounded p-6 text-center transition-colors',
          dragActive
            ? 'border-[#C8860A] bg-[#C8860A]/5'
            : 'border-[#2a2218] hover:border-[#6a5a4a]',
          uploading ? 'opacity-50 pointer-events-none' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {uploading ? (
          <p className="text-[#6a5a4a] font-mono text-xs">Uploading...</p>
        ) : (
          <>
            <p className="text-[#6a5a4a] font-mono text-xs mb-2">
              Drop a file here or{' '}
              <label className="text-[#C8860A] cursor-pointer underline underline-offset-2 hover:opacity-80 transition-opacity">
                click to select
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.csv"
                  onChange={handleFileInput}
                />
              </label>
            </p>
            <p className="text-[#6a5a4a] font-mono text-xs opacity-60">
              PDF, JPG, PNG, WebP, XLSX, CSV — max 25MB
            </p>
          </>
        )}
        {uploadError && (
          <p className="text-red-400 font-mono text-xs mt-2">{uploadError}</p>
        )}
      </div>
    </div>
  )
}
