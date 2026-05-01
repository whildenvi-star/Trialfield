'use client'

/**
 * ClaimDrawer — slide-over panel for claim detail (Phase 32 Plan 02).
 *
 * Follows PolicyDrawer pattern (Phase 30) for consistent right-slide interaction.
 * Three tabs: Timeline | Documents | Financials
 * Header always visible: crop name, date of loss, cause of loss, stage dropdown, close button.
 *
 * Stage dropdown change triggers same PATCH flow as drag-and-drop:
 *   PATCH /api/claims/[id] → onClaimUpdated() → optimistic stage_change timeline entry
 *
 * On open (or claim change): fetches timeline + documents in parallel via Promise.all.
 * Timeline and document state owned here; passed to child components as props.
 */

import { useEffect, useState, useCallback } from 'react'
import type { Claim } from './claim-card'
import { STAGE_ORDER, STAGE_LABELS } from '@/lib/claims/calc'
import { TimelineFeed } from './timeline-feed'
import { DocumentUpload } from './document-upload'

// Timeline event shape returned by GET /api/claims/[id]/timeline
export interface TimelineEvent {
  id?: string
  claim_id?: string
  event_type: string
  note?: string | null
  event_data?: Record<string, unknown> | null
  actor_id?: string | null
  created_at: string
  // Optimistic entries may not have an id yet (before server confirms)
  _optimistic?: boolean
}

// Document shape returned by GET /api/claims/[id]/documents (with signedUrl)
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

// FSA cross-reference data fetched from /api/fsa/clu-summary
interface FsaCluSummary {
  farm_number: string | null
  farm_name: string | null
  crop: string | null
  crop_year: number
  total_clu_count: number
  confirmed_count: number
  unconfirmed_count: number
  total_fsa_ac: number
  confirmed_fsa_ac: number
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

export function ClaimDrawer({ open, claim, onClose, onClaimUpdated }: ClaimDrawerProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('timeline')
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [documents, setDocuments] = useState<ClaimDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [stageUpdating, setStageUpdating] = useState(false)
  const [fsaSummary, setFsaSummary] = useState<FsaCluSummary | null>(null)
  const [fsaLoading, setFsaLoading] = useState(false)

  // Fetch timeline + documents in parallel when drawer opens or claim changes
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
      // Non-fatal — leave empty arrays, claim header/financials still visible
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && claim) {
      fetchData(claim.id)
      setActiveTab('timeline')
      setFsaSummary(null)
    }
  }, [open, claim, fetchData])

  // Lazy-load FSA cross-reference when Financials tab is opened
  useEffect(() => {
    if (activeTab !== 'financials' || !claim?.policy_id || fsaSummary || fsaLoading) return
    setFsaLoading(true)
    fetch(`/api/fsa/clu-summary?policy_id=${claim.policy_id}`)
      .then((r) => r.json())
      .then((d) => setFsaSummary(d.error ? null : d))
      .catch(() => {})
      .finally(() => setFsaLoading(false))
  }, [activeTab, claim, fsaSummary, fsaLoading])

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
        // Optimistically add stage_change entry to local timeline
        const stageEvent: TimelineEvent = {
          event_type: 'stage_change',
          event_data: { from: claim.stage, to: newStage },
          created_at: new Date().toISOString(),
          _optimistic: true,
        }
        setTimeline((prev) => [...prev, stageEvent])
      }
    } catch {
      // No local revert needed — parent ClaimsWorkspace manages its own optimism
    } finally {
      setStageUpdating(false)
    }
  }

  // Called by DocumentUpload after successful upload to refresh the document list
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
        ? 'border-b-glomalin-accent text-glomalin-accent'
        : 'border-b-transparent text-glomalin-muted hover:text-glomalin-text',
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
          'bg-glomalin-surface border-l border-glomalin-border',
          'flex flex-col transition-transform duration-200',
          open ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        {/* Header — always visible */}
        <div className="px-5 py-4 border-b border-glomalin-border flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="font-mono font-bold text-lg text-glomalin-text truncate">
                {claim?.crop ?? '—'}
              </h2>
              <div className="mt-0.5 text-xs text-glomalin-muted font-mono space-y-0.5">
                {claim?.date_of_loss && (
                  <p>
                    Date of Loss:{' '}
                    <span className="text-glomalin-text">
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
                    <span className="text-glomalin-text">{claim.cause_of_loss}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="text-glomalin-muted hover:text-glomalin-text transition-colors font-mono text-xl leading-none flex-shrink-0 mt-0.5"
              aria-label="Close drawer"
            >
              ×
            </button>
          </div>

          {/* Stage dropdown */}
          <div className="mt-3">
            <label className="block text-xs text-glomalin-muted font-mono mb-1">Stage</label>
            <select
              value={claim?.stage ?? ''}
              onChange={(e) => handleStageChange(e.target.value)}
              disabled={stageUpdating || !claim}
              className="w-full bg-glomalin-bg border border-glomalin-border text-glomalin-text font-mono text-sm rounded px-2 py-1.5 focus:outline-none focus:border-glomalin-accent transition-colors disabled:opacity-50"
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
        <div className="flex border-b border-glomalin-border flex-shrink-0">
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

        {/* Tab content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {loading && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-glomalin-muted font-mono text-xs">Loading...</p>
            </div>
          )}

          {!loading && (
            <>
              {/* Timeline tab — TimelineFeed from timeline-feed.tsx */}
              {activeTab === 'timeline' && (
                <TimelineFeed
                  claimId={claim?.id ?? ''}
                  timeline={timeline}
                  setTimeline={setTimeline}
                  onSwitchTab={() => setActiveTab('documents')}
                />
              )}

              {/* Documents tab — DocumentUpload from document-upload.tsx */}
              {activeTab === 'documents' && (
                <DocumentUpload
                  claimId={claim?.id ?? ''}
                  documents={documents}
                  onUploadComplete={refetchDocuments}
                />
              )}

              {/* Financials tab — read-only from claim object + FSA cross-ref */}
              {activeTab === 'financials' && (
                <FinancialsTab claim={claim} fsaSummary={fsaSummary} fsaLoading={fsaLoading} />
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Financials tab — read-only summary from claim object + FSA cross-reference
// ---------------------------------------------------------------------------

function FinancialsTab({
  claim,
  fsaSummary,
  fsaLoading,
}: {
  claim: Claim | null
  fsaSummary: FsaCluSummary | null
  fsaLoading: boolean
}) {
  if (!claim) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-glomalin-muted font-mono text-xs">No claim selected.</p>
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

  // Variance: insurance planted acres vs FSA confirmed acres
  const insurancePlanted =
    typeof claim['planted_acres'] === 'number' ? (claim['planted_acres'] as number) : null
  const fsaConfirmed = fsaSummary?.confirmed_fsa_ac ?? null
  const acreVariance =
    insurancePlanted != null && fsaConfirmed != null
      ? Math.round((insurancePlanted - fsaConfirmed) * 100) / 100
      : null

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4">
      <p className="text-xs text-glomalin-accent font-mono font-semibold uppercase tracking-wide mb-4">
        Financial Summary
      </p>
      <div className="font-mono">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex justify-between py-2 border-b border-glomalin-border"
          >
            <span className="text-glomalin-muted text-xs">{row.label}</span>
            <span className="text-glomalin-text text-xs">{row.value}</span>
          </div>
        ))}
      </div>

      {/* Adjuster section (if present) */}
      {claim.adjuster_name && (
        <div className="mt-4 pt-4 border-t border-glomalin-border">
          <p className="text-xs text-glomalin-accent font-mono font-semibold uppercase tracking-wide mb-3">
            Adjuster
          </p>
          <div className="flex justify-between py-2 border-b border-glomalin-border">
            <span className="text-glomalin-muted text-xs font-mono">Name</span>
            <span className="text-glomalin-text text-xs font-mono">{claim.adjuster_name as string}</span>
          </div>
          {claim.adjuster_phone && (
            <div className="flex justify-between py-2 border-b border-glomalin-border">
              <span className="text-glomalin-muted text-xs font-mono">Phone</span>
              <span className="text-glomalin-text text-xs font-mono">{claim.adjuster_phone as string}</span>
            </div>
          )}
        </div>
      )}

      {/* FSA Cross-Reference — pulled from clu_records, nothing manually entered */}
      <div className="mt-4 pt-4 border-t border-glomalin-border">
        <p className="text-xs text-glomalin-accent font-mono font-semibold uppercase tracking-wide mb-3">
          FSA Cross-Reference
        </p>

        {fsaLoading && (
          <p className="text-xs font-mono text-glomalin-muted animate-pulse">
            Loading FSA data...
          </p>
        )}

        {!fsaLoading && !claim.policy_id && (
          <p className="text-xs font-mono text-glomalin-muted">
            No linked policy — FSA cross-reference unavailable.
          </p>
        )}

        {!fsaLoading && claim.policy_id && !fsaSummary && (
          <p className="text-xs font-mono text-glomalin-muted">
            No FSA records found for this policy&apos;s farm + crop combination.
          </p>
        )}

        {!fsaLoading && fsaSummary && (
          <div className="font-mono">
            <div className="flex justify-between py-2 border-b border-glomalin-border">
              <span className="text-glomalin-muted text-xs">Farm</span>
              <span className="text-glomalin-text text-xs">
                {fsaSummary.farm_name ?? `Farm ${fsaSummary.farm_number ?? '—'}`}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-glomalin-border">
              <span className="text-glomalin-muted text-xs">Crop (FSA)</span>
              <span className="text-glomalin-text text-xs">{fsaSummary.crop ?? '—'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-glomalin-border">
              <span className="text-glomalin-muted text-xs">Total FSA Acres</span>
              <span className="text-glomalin-text text-xs">{fsaSummary.total_fsa_ac.toFixed(2)} ac</span>
            </div>
            <div className="flex justify-between py-2 border-b border-glomalin-border">
              <span className="text-glomalin-muted text-xs">Confirmed FSA Acres</span>
              <span
                className={`text-xs ${
                  fsaSummary.unconfirmed_count > 0 ? 'text-amber-400' : 'text-glomalin-green'
                }`}
              >
                {fsaSummary.confirmed_fsa_ac.toFixed(2)} ac
                {fsaSummary.unconfirmed_count > 0 && (
                  <span className="text-glomalin-muted ml-1">
                    ({fsaSummary.unconfirmed_count} unconfirmed)
                  </span>
                )}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-glomalin-border">
              <span className="text-glomalin-muted text-xs">CLUs Reported</span>
              <span className="text-glomalin-text text-xs">
                {fsaSummary.confirmed_count} / {fsaSummary.total_clu_count}
              </span>
            </div>
            {acreVariance !== null && (
              <div className="flex justify-between py-2 border-b border-glomalin-border">
                <span className="text-glomalin-muted text-xs">Insurance vs FSA Variance</span>
                <span
                  className={`text-xs font-semibold ${
                    Math.abs(acreVariance) <= 1
                      ? 'text-glomalin-green'
                      : Math.abs(acreVariance) <= 5
                      ? 'text-amber-400'
                      : 'text-red-400'
                  }`}
                >
                  {acreVariance > 0 ? '+' : ''}{acreVariance.toFixed(2)} ac
                </span>
              </div>
            )}
            <p className="text-[10px] font-mono text-glomalin-muted mt-2">
              Source: FSA Form 578 records (clu_records table) — not manually entered
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
