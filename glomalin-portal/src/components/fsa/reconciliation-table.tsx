'use client'

import { useState } from 'react'
import type { ReconciliationRow } from '@/lib/fsa/reconciliation'

// ── Status helpers ────────────────────────────────────────────────────────────

function StatusPip({ status }: { status: ReconciliationRow['status'] }) {
  const classes = {
    ok:         'bg-glomalin-green text-black',
    flagged:    'bg-yellow-500 text-black',
    unresolved: 'bg-red-500 text-white',
  }[status]

  const labels = { ok: '✓', flagged: '⚠', unresolved: '✗' }

  return (
    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${classes}`}>
      {labels[status]}
    </span>
  )
}

function causeLabel(cause: ReconciliationRow['cause']): string {
  const map: Record<string, string> = {
    within_tolerance: '—',
    unmapped_waterway: 'Waterway gap',
    boundary_creep:    'Boundary creep',
    unknown:           'Unknown',
  }
  return map[cause] ?? cause
}

// ── Confirm button (marks clu_record.reported = true) ────────────────────────

function ConfirmButton({
  row,
  onConfirmed,
}: {
  row: ReconciliationRow
  onConfirmed: () => void
}) {
  const [loading, setLoading] = useState(false)

  if (!row.clu_record_id) return null
  if (row.reported) {
    return (
      <span className="text-[10px] font-mono text-glomalin-green">Confirmed</span>
    )
  }

  async function confirm() {
    setLoading(true)
    try {
      await fetch(`/api/fsa/clu-records/${row.clu_record_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reported: true }),
      })
      onConfirmed()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={confirm}
      disabled={loading || row.status === 'unresolved'}
      title={row.status === 'unresolved' ? 'Resolve delta before confirming' : undefined}
      className="px-2 py-0.5 rounded border border-glomalin-green/40 text-glomalin-green text-[10px] font-mono hover:bg-glomalin-green/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      {loading ? '…' : 'Confirm'}
    </button>
  )
}

// ── Main table ────────────────────────────────────────────────────────────────

interface ReconciliationTableProps {
  rows: ReconciliationRow[]
  highlightClu: string | null
  onRowClick: (cluLabel: string) => void
  onConfirmed: () => void
}

export function ReconciliationTable({
  rows,
  highlightClu,
  onRowClick,
  onConfirmed,
}: ReconciliationTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-xs font-mono text-glomalin-muted">
        Select a farm to view reconciliation data.
      </div>
    )
  }

  // Group rows by tract for visual separation
  const byTract = new Map<string, ReconciliationRow[]>()
  for (const row of rows) {
    const t = row.tract_number
    if (!byTract.has(t)) byTract.set(t, [])
    byTract.get(t)!.push(row)
  }

  return (
    <div className="overflow-y-auto h-full text-xs font-mono">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 bg-glomalin-surface z-10">
          <tr className="border-b border-glomalin-border text-[10px] text-glomalin-muted uppercase tracking-wider">
            <th className="text-left px-3 py-2 w-6"></th>
            <th className="text-left px-3 py-2">CLU</th>
            <th className="text-left px-3 py-2">Crop</th>
            <th className="text-right px-3 py-2">FSA ac</th>
            <th className="text-right px-3 py-2">Zone ac</th>
            <th className="text-right px-3 py-2">Δ ac</th>
            <th className="text-left px-3 py-2">Cause</th>
            <th className="text-left px-3 py-2">Org</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {Array.from(byTract.entries()).map(([tract, tractRows]) => (
            <>
              <tr key={`tract-${tract}`}>
                <td
                  colSpan={9}
                  className="px-3 py-1 text-[9px] text-glomalin-muted uppercase tracking-widest bg-glomalin-highlight border-t border-glomalin-border"
                >
                  Tract {tract}
                </td>
              </tr>
              {tractRows.map((row) => {
                const isHighlighted = row.clu_label === highlightClu
                const deltaFmt = row.delta > 0 ? `+${row.delta.toFixed(2)}` : row.delta.toFixed(2)
                const deltaClass =
                  row.status === 'ok'         ? 'text-glomalin-green' :
                  row.status === 'flagged'    ? 'text-yellow-400' :
                                                'text-red-400'

                return (
                  <tr
                    key={`${row.tract_number}::${row.clu_label}`}
                    onClick={() => onRowClick(row.clu_label)}
                    className={`border-b border-glomalin-border/50 cursor-pointer transition-colors ${
                      isHighlighted
                        ? 'bg-glomalin-highlight border-l-2 border-l-glomalin-accent'
                        : 'hover:bg-glomalin-highlight/60'
                    }`}
                  >
                    <td className="px-3 py-2">
                      <StatusPip status={row.status} />
                    </td>
                    <td className="px-3 py-2 text-glomalin-text font-medium">
                      {row.clu_label}
                    </td>
                    <td className="px-3 py-2 text-glomalin-muted max-w-[100px] truncate" title={row.crop ?? ''}>
                      {row.crop ?? <span className="text-glomalin-muted/50 italic">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-glomalin-text tabular-nums">
                      {row.fsa_acres.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right text-glomalin-muted tabular-nums">
                      {row.zones.length > 0 ? row.zone_acres.toFixed(2) : <span className="italic">—</span>}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums font-medium ${deltaClass}`}>
                      {row.zones.length > 0 ? deltaFmt : <span className="text-glomalin-muted/50 italic">—</span>}
                    </td>
                    <td className="px-3 py-2 text-glomalin-muted">
                      {causeLabel(row.cause)}
                    </td>
                    <td className="px-3 py-2">
                      {row.organic
                        ? <span className="text-glomalin-green">ORG</span>
                        : <span className="text-glomalin-muted/40">—</span>
                      }
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <ConfirmButton row={row} onConfirmed={onConfirmed} />
                    </td>
                  </tr>
                )
              })}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}
