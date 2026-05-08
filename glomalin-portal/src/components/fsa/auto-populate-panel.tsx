'use client'

import { useState } from 'react'
import type { CluRecord } from '@/lib/fsa/calc'

interface Proposal {
  cluId: string
  legacyId: string
  fieldName: string | null
  farmNumber: string
  tractNumber: string
  clu: string
  fsaAcres: number
  currentCrop: string | null
  proposedCrop: string | null
  matchConfidence: 'exact' | 'suggested' | 'none'
}

interface AutoPopulatePanelProps {
  onClose: () => void
  onRecordsUpdated: (updated: CluRecord[]) => void
}

const CONFIDENCE_STYLE: Record<Proposal['matchConfidence'], string> = {
  exact:     'bg-green-900/40 text-green-400',
  suggested: 'bg-amber-900/40 text-amber-400',
  none:      'bg-glomalin-border text-glomalin-muted',
}

export function AutoPopulatePanel({ onClose, onRecordsUpdated }: AutoPopulatePanelProps) {
  const [loading, setLoading]       = useState(false)
  const [applying, setApplying]     = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [proposals, setProposals]   = useState<Proposal[] | null>(null)
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [summary, setSummary]       = useState<{ exact: number; suggested: number; none: number } | null>(null)

  const fetchProposals = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/fsa/auto-populate-preview')
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to load proposals')
        return
      }
      const list: Proposal[] = json.proposals ?? []
      setProposals(list)

      // Pre-select exact matches; leave suggested unchecked
      const preSelected = new Set<string>()
      let exact = 0, suggested = 0, none = 0
      for (const p of list) {
        if (p.matchConfidence === 'exact') { preSelected.add(p.cluId); exact++ }
        else if (p.matchConfidence === 'suggested') suggested++
        else none++
      }
      setSelected(preSelected)
      setSummary({ exact, suggested, none })
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleApply = async () => {
    if (!proposals || selected.size === 0) return
    setApplying(true)
    setError(null)

    // Group selected proposals by proposed crop
    const byCrop = new Map<string, string[]>()
    for (const p of proposals) {
      if (!selected.has(p.cluId) || !p.proposedCrop) continue
      const ids = byCrop.get(p.proposedCrop) ?? []
      ids.push(p.cluId)
      byCrop.set(p.proposedCrop, ids)
    }

    const updatedRecords: CluRecord[] = []
    let failed = false

    for (const [crop, ids] of Array.from(byCrop)) {
      try {
        const res = await fetch('/api/fsa/clu-records/bulk-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, action: 'assign-crop', crop }),
        })
        const json = await res.json()
        if (!res.ok) { failed = true; continue }
        if (Array.isArray(json.records)) {
          updatedRecords.push(...(json.records as CluRecord[]))
        }
      } catch {
        failed = true
      }
    }

    if (updatedRecords.length > 0) {
      onRecordsUpdated(updatedRecords)
    }

    if (failed) {
      setError('Some crops failed to apply — check the records and retry')
    } else {
      onClose()
    }
    setApplying(false)
  }

  return (
    <div className="bg-glomalin-surface border border-glomalin-border rounded-lg mb-6">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-glomalin-border">
        <h2 className="font-mono font-bold text-sm text-glomalin-text">Auto-Populate Crops</h2>
        <button
          onClick={onClose}
          className="font-mono text-xs text-glomalin-muted hover:text-glomalin-text transition-colors"
        >
          Close
        </button>
      </div>

      <div className="px-4 py-4">
        {!proposals && !loading && (
          <div className="flex items-center gap-4">
            <p className="font-mono text-xs text-glomalin-muted flex-1">
              Matches CLU records to farm-budget enterprises by crop name. Exact matches are pre-selected;
              review suggested matches before applying.
            </p>
            <button
              onClick={fetchProposals}
              className="font-mono text-sm font-bold bg-glomalin-accent text-glomalin-bg rounded px-4 py-2 hover:opacity-90 transition-opacity flex-shrink-0"
            >
              Load Proposals
            </button>
          </div>
        )}

        {loading && (
          <p className="font-mono text-xs text-glomalin-muted">Loading proposals from farm-budget...</p>
        )}

        {error && (
          <p className="font-mono text-xs text-red-400 mb-3">{error}</p>
        )}

        {proposals && (
          <>
            {/* Summary counts */}
            {summary && (
              <div className="flex gap-4 mb-4 font-mono text-xs text-glomalin-muted">
                <span className="text-green-400">{summary.exact} exact</span>
                <span className="text-amber-400">{summary.suggested} suggested</span>
                <span>{summary.none} unmatched</span>
                <span className="ml-auto text-glomalin-text">{selected.size} selected</span>
              </div>
            )}

            {proposals.length === 0 ? (
              <p className="font-mono text-xs text-glomalin-muted">No CLU records found for current crop year.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full font-mono text-xs border-collapse">
                  <thead>
                    <tr className="text-glomalin-muted text-left">
                      <th className="pb-2 pr-3 font-normal uppercase tracking-wider w-6"></th>
                      <th className="pb-2 pr-3 font-normal uppercase tracking-wider">Field</th>
                      <th className="pb-2 pr-3 font-normal uppercase tracking-wider">CLU</th>
                      <th className="pb-2 pr-3 font-normal uppercase tracking-wider text-right">Acres</th>
                      <th className="pb-2 pr-3 font-normal uppercase tracking-wider">Current Crop</th>
                      <th className="pb-2 pr-3 font-normal uppercase tracking-wider">Proposed Crop</th>
                      <th className="pb-2 font-normal uppercase tracking-wider">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proposals.map((p) => (
                      <tr
                        key={p.cluId}
                        className={`border-t border-glomalin-border cursor-pointer hover:bg-glomalin-bg/40 transition-colors ${
                          selected.has(p.cluId) ? 'bg-glomalin-bg/20' : ''
                        }`}
                        onClick={() => p.proposedCrop && toggleSelect(p.cluId)}
                      >
                        <td className="py-2 pr-3">
                          <input
                            type="checkbox"
                            checked={selected.has(p.cluId)}
                            disabled={!p.proposedCrop}
                            onChange={() => p.proposedCrop && toggleSelect(p.cluId)}
                            onClick={(e) => e.stopPropagation()}
                            className="accent-glomalin-accent"
                          />
                        </td>
                        <td className="py-2 pr-3 text-glomalin-text">
                          {p.fieldName ?? `F${p.farmNumber}-T${p.tractNumber}`}
                        </td>
                        <td className="py-2 pr-3 text-glomalin-muted">{p.clu}</td>
                        <td className="py-2 pr-3 text-glomalin-text text-right tabular-nums">
                          {p.fsaAcres.toFixed(1)}
                        </td>
                        <td className="py-2 pr-3 text-glomalin-muted">{p.currentCrop ?? '—'}</td>
                        <td className="py-2 pr-3 text-glomalin-text font-bold">
                          {p.proposedCrop ?? '—'}
                        </td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${CONFIDENCE_STYLE[p.matchConfidence]}`}>
                            {p.matchConfidence}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {proposals.length > 0 && (
              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={handleApply}
                  disabled={applying || selected.size === 0}
                  className="font-mono text-sm font-bold bg-glomalin-accent text-glomalin-bg rounded px-4 py-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {applying ? 'Applying...' : `Apply ${selected.size} Selected`}
                </button>
                <button
                  onClick={() => {
                    const allSelectable = proposals.filter((p) => p.proposedCrop).map((p) => p.cluId)
                    setSelected(new Set(allSelectable))
                  }}
                  className="font-mono text-xs text-glomalin-muted hover:text-glomalin-text transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={() => setSelected(new Set())}
                  className="font-mono text-xs text-glomalin-muted hover:text-glomalin-text transition-colors"
                >
                  Deselect All
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
