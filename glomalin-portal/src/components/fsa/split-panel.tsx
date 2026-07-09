'use client'

import { useState } from 'react'
import { Drawer } from '@/components/compliance/ui/drawer'
import { CropTypeahead } from '@/components/fsa/crop-typeahead'

export interface SplitProposal {
  sub_label: string
  geojson: string
  acres: number
  crop: string
  irrigated: boolean
  organic: boolean
  use: string
  source_label: string   // "Zone: Hughes East" | "Coverage 2026-05-12" | "Drawn"
}

interface SplitPanelProps {
  open: boolean
  onClose: () => void
  parentId: string
  parentFsaAcres: number
  parentLabel: string        // e.g. "CLU 1 — Farm 1234"
  initialProposals: SplitProposal[]
  onSplitComplete: (parentId: string) => void
}

const SUB_LABELS = ['a', 'b', 'c', 'd', 'e', 'f']

export function SplitPanel({
  open,
  onClose,
  parentId,
  parentFsaAcres,
  parentLabel,
  initialProposals,
  onSplitComplete,
}: SplitPanelProps) {
  const [proposals, setProposals] = useState<SplitProposal[]>(initialProposals)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  // Reset proposals when new ones arrive (e.g. after a new snip draw)
  // Using a key prop on Drawer handles this externally if needed

  function updateProposal(index: number, patch: Partial<SplitProposal>) {
    setProposals((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...patch } : p))
    )
  }

  const acresSum = proposals.reduce((s, p) => s + (p.acres || 0), 0)
  const acresDelta = Math.abs(acresSum - parentFsaAcres)
  const acresWarning = acresDelta > 0.5

  async function handleConfirm() {
    setError(null)

    // Client-side validation
    for (const p of proposals) {
      if (!p.crop.trim()) {
        setError('All sub-CLUs must have a crop assigned')
        return
      }
    }
    const labels = proposals.map((p) => p.sub_label)
    if (new Set(labels).size !== labels.length) {
      setError('Sub-labels must be unique')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/fsa/clu-records/${parentId}/split`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          splits: proposals.map((p) => ({
            sub_label: p.sub_label,
            geojson:   p.geojson,
            crop:      p.crop,
            irrigated: p.irrigated,
            organic:   p.organic,
            use:       p.use || null,
          })),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? `Server error ${res.status}`)
      }

      onSplitComplete(parentId)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title="Confirm CLU Split" width="md">
      <div className="space-y-4">
        {/* Parent context */}
        <div className="rounded border border-glomalin-border/50 bg-glomalin-bg px-3 py-2">
          <p className="text-[10px] font-mono text-glomalin-muted uppercase tracking-widest mb-0.5">
            Splitting
          </p>
          <p className="text-xs font-mono text-glomalin-text">{parentLabel}</p>
          <p className="text-[10px] font-mono text-glomalin-muted mt-0.5">
            FSA acres: {parentFsaAcres?.toFixed(2) ?? '—'}
          </p>
        </div>

        {/* Acres sum check */}
        {acresWarning && (
          <div className="rounded border border-amber-800/40 bg-amber-900/10 px-3 py-2">
            <p className="text-[10px] font-mono text-amber-400">
              ⚠ Sub-CLU acres sum to {acresSum.toFixed(2)} ac — differs from FSA acres ({parentFsaAcres?.toFixed(2)}) by {acresDelta.toFixed(2)} ac
            </p>
          </div>
        )}

        {/* Sub-CLU rows */}
        <div className="space-y-3">
          {proposals.map((p, i) => (
            <div key={i} className="rounded border border-glomalin-border bg-glomalin-bg p-3 space-y-2">
              {/* Row header */}
              <div className="flex items-center gap-2">
                <select
                  value={p.sub_label}
                  onChange={(e) => updateProposal(i, { sub_label: e.target.value })}
                  className="bg-glomalin-surface border border-glomalin-border rounded px-2 py-1 text-xs font-mono text-glomalin-text focus:outline-none focus:border-glomalin-accent w-16"
                >
                  {SUB_LABELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] font-mono text-glomalin-muted flex-1 truncate">
                  {p.source_label}
                </span>
                <span className="text-xs font-mono text-glomalin-text shrink-0 tabular-nums">
                  {p.acres.toFixed(2)} ac
                </span>
              </div>

              {/* Crop */}
              <div>
                <label className="block text-[9px] font-mono text-glomalin-muted uppercase tracking-widest mb-1">
                  Crop
                </label>
                <CropTypeahead
                  value={p.crop}
                  onChange={(v) => updateProposal(i, { crop: v })}
                />
              </div>

              {/* Intended use */}
              <div>
                <label className="block text-[9px] font-mono text-glomalin-muted uppercase tracking-widest mb-1">
                  Intended use
                </label>
                <input
                  type="text"
                  value={p.use}
                  onChange={(e) => updateProposal(i, { use: e.target.value })}
                  placeholder="e.g. GR (grain), SE (seed), SI (silage)"
                  className="w-full bg-glomalin-surface border border-glomalin-border rounded px-2 py-1.5 font-mono text-xs text-glomalin-text placeholder:text-glomalin-muted/40 focus:outline-none focus:border-glomalin-accent"
                />
              </div>

              {/* Practice toggles */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={p.irrigated}
                    onChange={(e) => updateProposal(i, { irrigated: e.target.checked })}
                    className="accent-glomalin-accent"
                  />
                  <span className="text-[10px] font-mono text-glomalin-text">Irrigated</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={p.organic}
                    onChange={(e) => updateProposal(i, { organic: e.target.checked })}
                    className="accent-glomalin-accent"
                  />
                  <span className="text-[10px] font-mono text-glomalin-text">Organic</span>
                </label>
              </div>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs font-mono text-red-400">{error}</p>
        )}

        {/* Footer actions */}
        <div className="flex items-center gap-3 pt-2 border-t border-glomalin-border">
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="flex-1 py-2 rounded bg-glomalin-accent text-black text-xs font-mono font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Splitting...' : 'Confirm Split'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded border border-glomalin-border text-glomalin-muted text-xs font-mono hover:text-glomalin-text transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* Undo note */}
        <p className="text-[9px] font-mono text-glomalin-muted/50 text-center">
          Original CLU record is preserved — splits can be undone before reporting
        </p>
      </div>
    </Drawer>
  )
}
