'use client'

/**
 * TimelineFeed — unified chronological feed for claim events and user notes.
 *
 * Renders system events (stage_change, doc_upload, etc.) in muted gray styling
 * and user notes with accent (glomalin-accent) left border per Phase 32 CONTEXT.md design decision:
 * "Unified chronological feed mixing system events and user notes"
 *
 * Note submission is optimistic — appends immediately to local state, replaces with
 * server-returned event on success, removes on failure.
 *
 * Append-only: no edit or delete controls (audit integrity per CONTEXT.md).
 */

import { useState } from 'react'
import { STAGE_LABELS } from '@/lib/claims/calc'
import type { TimelineEvent } from './claim-drawer'

interface TimelineFeedProps {
  claimId: string
  timeline: TimelineEvent[]
  setTimeline: React.Dispatch<React.SetStateAction<TimelineEvent[]>>
  onSwitchTab?: () => void
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
 * Renders a single timeline event row.
 * - note: accent left border, accent color text
 * - system events: muted gray with dot icon
 */
function TimelineEventRow({
  event,
  onSwitchToDocuments,
}: {
  event: TimelineEvent
  onSwitchToDocuments?: () => void
}) {
  const timestamp = formatDate(event.created_at)

  if (event.event_type === 'note') {
    return (
      <div className="border-l-2 border-l-glomalin-accent pl-3">
        <p className="text-glomalin-text text-xs font-mono leading-relaxed">{event.note}</p>
        <p className="text-glomalin-muted text-xs font-mono mt-0.5">{timestamp}</p>
      </div>
    )
  }

  let systemText = ''
  switch (event.event_type) {
    case 'stage_change': {
      const from = event.event_data?.from as string | undefined
      const to = event.event_data?.to as string | undefined
      const fromLabel = from ? (STAGE_LABELS[from] ?? from) : '?'
      const toLabel = to ? (STAGE_LABELS[to] ?? to) : '?'
      systemText = `Stage changed: ${fromLabel} \u2192 ${toLabel}`
      break
    }
    case 'doc_upload': {
      const filename = event.event_data?.filename as string | undefined
      const docText = filename ? `Document uploaded: ${filename}` : 'Document uploaded'
      return (
        <div className="flex items-start gap-2">
          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-glomalin-muted flex-shrink-0" />
          <div>
            <p className="text-glomalin-muted text-xs font-mono">
              {docText}
              {onSwitchToDocuments && (
                <>
                  {' '}
                  <button
                    onClick={onSwitchToDocuments}
                    className="text-glomalin-accent underline underline-offset-2 hover:opacity-80 transition-opacity"
                  >
                    View
                  </button>
                </>
              )}
            </p>
            <p className="text-glomalin-muted text-xs font-mono opacity-60 mt-0.5">{timestamp}</p>
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
      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-glomalin-muted flex-shrink-0" />
      <div>
        <p className="text-glomalin-muted text-xs font-mono">{systemText}</p>
        <p className="text-glomalin-muted text-xs font-mono opacity-60 mt-0.5">{timestamp}</p>
      </div>
    </div>
  )
}

/**
 * TimelineFeed — timeline area + always-visible inline note textarea.
 *
 * Props:
 *   claimId    — used for POST /api/claims/[id]/timeline
 *   timeline   — state owned by ClaimDrawer, passed down
 *   setTimeline — allows optimistic add/replace/remove
 *   onSwitchTab — callback to switch ClaimDrawer to the Documents tab
 */
export function TimelineFeed({ claimId, timeline, setTimeline, onSwitchTab }: TimelineFeedProps) {
  const [noteText, setNoteText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [noteError, setNoteError] = useState<string | null>(null)

  async function handleAddNote(text: string) {
    const trimmed = text.trim()
    if (!trimmed || !claimId) return

    setSubmitting(true)
    setNoteError(null)

    // Optimistic append — appears immediately in feed
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

      // Replace last optimistic note with server-returned event (real id + actor_id)
      setTimeline((prev) => {
        const idx = prev.findLastIndex(
          (e) => e._optimistic === true && e.event_type === 'note',
        )
        if (idx === -1) return [...prev, event]
        const next = [...prev]
        next[idx] = event
        return next
      })
    } catch {
      // Remove optimistic entry and restore textarea for retry
      setTimeline((prev) => {
        const idx = prev.findLastIndex(
          (e) => e._optimistic === true && e.event_type === 'note',
        )
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
      {/* Timeline feed — scrollable, newest at bottom */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {timeline.length === 0 && (
          <p className="text-glomalin-muted font-mono text-xs">No events yet.</p>
        )}
        {timeline.map((event, idx) => (
          <TimelineEventRow
            key={event.id ?? `optimistic-${idx}`}
            event={event}
            onSwitchToDocuments={onSwitchTab}
          />
        ))}
      </div>

      {/* Always-visible inline note input at bottom of Timeline tab */}
      <div className="border-t border-glomalin-border px-5 py-4 flex-shrink-0">
        {noteError && (
          <p className="text-red-400 text-xs font-mono mb-2">{noteError}</p>
        )}
        <textarea
          className="w-full rounded border border-glomalin-border bg-glomalin-bg text-glomalin-text text-xs font-mono p-2 resize-none focus:outline-none focus:border-glomalin-accent transition-colors placeholder:text-glomalin-muted"
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
            className="text-xs bg-glomalin-accent text-glomalin-bg rounded px-3 py-1 font-mono font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {submitting ? 'Saving...' : 'Add Note'}
          </button>
        </div>
      </div>
    </div>
  )
}
