'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { DeadlineAlertBanner } from './deadline-alert-banner'
import { ClaimDrawer } from './claim-drawer'
import type { Claim } from './claim-card'

// SSR guard — dnd-kit uses browser-only APIs (window, pointer events)
// This is an architectural requirement (STATE.md v6.0 decision): ClaimsKanban must
// NEVER be server-rendered. dynamic() with ssr:false is applied from the first commit.
const ClaimsKanban = dynamic(
  () => import('./claims-kanban').then((m) => ({ default: m.ClaimsKanban })),
  {
    ssr: false,
    loading: () => (
      <div className="text-glomalin-muted font-mono text-sm py-12 text-center">
        Loading board...
      </div>
    ),
  },
)

interface ClaimsWorkspaceProps {
  initialClaims: Claim[]
}

/**
 * Top-level client orchestrator for the Claims module.
 * Manages claims state, optimistic drag-and-drop mutations, and skippable note prompt.
 * Prepares selectedClaimId and drawerOpen state for Plan 32-02 ClaimDrawer.
 */
export function ClaimsWorkspace({ initialClaims }: ClaimsWorkspaceProps) {
  const [claims, setClaims] = useState<Claim[]>(initialClaims)

  // Drawer state — ClaimDrawer will be added in Plan 32-02
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Note prompt after stage change: tracks which claim to prompt for
  const [pendingNoteClaimId, setPendingNoteClaimId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const noteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-dismiss note prompt after 10 seconds
  useEffect(() => {
    if (pendingNoteClaimId) {
      noteTimerRef.current = setTimeout(() => {
        setPendingNoteClaimId(null)
        setNoteText('')
      }, 10_000)
    }
    return () => {
      if (noteTimerRef.current) clearTimeout(noteTimerRef.current)
    }
  }, [pendingNoteClaimId])

  function dismissNotePrompt() {
    if (noteTimerRef.current) clearTimeout(noteTimerRef.current)
    setPendingNoteClaimId(null)
    setNoteText('')
  }

  async function handleSubmitNote() {
    if (!pendingNoteClaimId || !noteText.trim()) {
      dismissNotePrompt()
      return
    }
    const claimId = pendingNoteClaimId
    dismissNotePrompt()
    // Non-blocking: post note to timeline; ignore failures silently (non-fatal)
    try {
      await fetch(`/api/claims/${claimId}/timeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: 'note', note: noteText.trim() }),
      })
    } catch {
      // Note submission failure is non-fatal — claim stage already persisted
    }
  }

  async function handleStageChange(claimId: string, newStage: string) {
    // Capture previous state for optimistic revert
    const previousClaims = claims

    // Optimistic update: move card immediately
    setClaims((prev) =>
      prev.map((c) => (c.id === claimId ? { ...c, stage: newStage } : c)),
    )

    try {
      const res = await fetch(`/api/claims/${claimId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      })

      if (!res.ok) {
        // Revert optimistic update on failure
        setClaims(previousClaims)
        return
      }

      // Successful stage change — show skippable note prompt (bottom-right toast)
      setPendingNoteClaimId(claimId)
      setNoteText('')
    } catch {
      // Network error — revert
      setClaims(previousClaims)
    }
  }

  function handleCardClick(id: string) {
    setSelectedClaimId(id)
    setDrawerOpen(true)
  }

  function handleClaimUpdated(updated: Claim) {
    setClaims((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
  }

  const selectedClaim = claims.find((c) => c.id === selectedClaimId) ?? null

  return (
    <div className="min-h-screen bg-glomalin-bg text-glomalin-text">
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-mono font-semibold text-glomalin-text">Claims</h1>
          <p className="mt-1 text-sm text-glomalin-muted font-mono">
            Crop Insurance Claims Tracking
          </p>
        </div>

        {/* Tracking disclaimer */}
        <div className="mb-6 px-4 py-3 rounded border border-glomalin-border bg-glomalin-surface text-xs text-glomalin-muted font-mono">
          This is a tracking tool for producer records. It does not file or submit claims
          to insurance companies.
        </div>

        {/* Deadline alert banner — persistent, not dismissible */}
        <DeadlineAlertBanner claims={claims} />

        {/* Kanban board — SSR-guarded via dynamic({ ssr: false }) */}
        <ClaimsKanban
          claims={claims}
          onStageChange={handleStageChange}
          onCardClick={handleCardClick}
        />

        {/* Claim detail drawer — direct import (no browser-only DnD APIs) */}
        <ClaimDrawer
          open={drawerOpen}
          claim={selectedClaim}
          onClose={() => setDrawerOpen(false)}
          onClaimUpdated={handleClaimUpdated}
        />

        {/* Note prompt — bottom-right floating toast, auto-dismisses after 10s */}
        {pendingNoteClaimId && (
          <div className="fixed bottom-6 right-6 z-50 w-80 rounded border border-glomalin-border bg-glomalin-surface shadow-xl shadow-black/60 p-4 font-mono">
            <p className="text-xs text-glomalin-muted mb-2">
              Add a note about this stage change?
            </p>
            <textarea
              className="w-full rounded border border-glomalin-border bg-glomalin-bg text-glomalin-text text-xs p-2 resize-none focus:outline-none focus:border-glomalin-accent transition-colors"
              rows={2}
              placeholder="Optional note..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 mt-2">
              <button
                onClick={dismissNotePrompt}
                className="text-xs text-glomalin-muted hover:text-glomalin-text transition-colors px-2 py-1"
              >
                Skip
              </button>
              <button
                onClick={handleSubmitNote}
                className="text-xs bg-glomalin-accent text-glomalin-bg rounded px-3 py-1 font-semibold hover:opacity-90 transition-opacity"
              >
                Add Note
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
