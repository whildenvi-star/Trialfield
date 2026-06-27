'use client'

import { useState } from 'react'
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from '@/components/ui/table'
import { BasisQuoteForm } from '@/components/marketing/basis-quote-form'

// BasisQuote type — supports both API shape (basisValue) and test fixture shape (basis)
type BasisQuote = {
  id: string
  variantId: string
  // basisValue is the canonical API field; basis is the simplified test-fixture field.
  // The component reads whichever is present.
  basisValue?: number
  basis?: number
  futuresMonth?: string | null
  quoteDate?: string | null
  quotedAt?: string | null
  location?: string | null
  source?: string | null
  confidenceTier?: string | null
  confidence?: string | null
  notes?: string | null
  farmId?: string
  variant: {
    id: string
    name: string
    cropYear?: number
    commodity?: { name: string; symbol?: string }
  }
}

type GrainVariant = {
  id: string
  name: string
  cropYear?: number
  commodity?: { name: string; symbol?: string }
}

interface BasisQuoteListClientProps {
  quotes: BasisQuote[]
  variants: GrainVariant[]
  role?: 'owner' | 'office'
  /** Optional pre-selected variant filter (used by tests and URL param hydration) */
  initialVariantFilter?: string
}

// ── Badge helpers ─────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  ELEVATOR_QUOTE: 'Elevator',
  MANUAL: 'Manual',
  BROKERED: 'Brokered',
}

function SourceBadge({ source }: { source: string }) {
  const label = SOURCE_LABELS[source] ?? source
  const isBrokered = source === 'BROKERED'
  const cls = isBrokered
    ? 'inline-block font-mono text-xs px-1.5 py-0.5 rounded border border-glomalin-accent/50 text-glomalin-accent bg-glomalin-accent/10'
    : 'inline-block font-mono text-xs px-1.5 py-0.5 rounded border border-glomalin-border text-glomalin-muted bg-glomalin-bg'
  return <span className={cls}>{label}</span>
}

const CONFIDENCE_LABELS: Record<string, string> = {
  CONFIDENT: 'Confident',
  INFERRED: 'Inferred',
  MANUAL: 'Manual',
  UNVERIFIED: 'Unverified',
}

const CONFIDENCE_CLS: Record<string, string> = {
  CONFIDENT:
    'inline-block font-mono text-xs px-1.5 py-0.5 rounded border border-glomalin-tier-confident/40 text-glomalin-tier-confident bg-glomalin-tier-confident/10',
  INFERRED:
    'inline-block font-mono text-xs px-1.5 py-0.5 rounded border border-glomalin-tier-inferred/40 text-glomalin-tier-inferred bg-glomalin-tier-inferred/10',
  MANUAL:
    'inline-block font-mono text-xs px-1.5 py-0.5 rounded border border-glomalin-tier-manual/40 text-glomalin-tier-manual bg-glomalin-tier-manual/10',
  UNVERIFIED:
    'inline-block font-mono text-xs px-1.5 py-0.5 rounded border border-glomalin-border text-glomalin-tier-unverified bg-glomalin-bg',
}

function ConfidenceBadge({ tier }: { tier: string }) {
  const label = CONFIDENCE_LABELS[tier] ?? tier
  const cls = CONFIDENCE_CLS[tier] ?? CONFIDENCE_CLS['UNVERIFIED']
  return <span className={cls}>{label}</span>
}

// ── Date formatting ───────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const yyyy = d.getUTCFullYear()
  return `${mm}/${dd}/${yyyy}`
}

// ── Main component ────────────────────────────────────────────────────────────

export function BasisQuoteListClient({
  quotes,
  variants,
  role,
  initialVariantFilter = '',
}: BasisQuoteListClientProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<string>(initialVariantFilter)
  const [logOpen, setLogOpen] = useState(false)

  // Filtering
  const filtered =
    selectedVariantId === ''
      ? quotes
      : quotes.filter((q) => q.variantId === selectedVariantId)

  // Sort newest date first
  const sorted = [...filtered].sort((a, b) => {
    const aDate = a.quoteDate ?? a.quotedAt ?? ''
    const bDate = b.quoteDate ?? b.quotedAt ?? ''
    return new Date(bDate).getTime() - new Date(aDate).getTime()
  })

  function variantDisplayName(q: BasisQuote): string {
    if (q.variant.commodity) {
      return `${q.variant.commodity.name} — ${q.variant.name}`
    }
    return q.variant.name
  }

  function getBasisValue(q: BasisQuote): number {
    // Accept either canonical basisValue (API) or basis (test fixture)
    return q.basisValue ?? q.basis ?? 0
  }

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h1 className="font-heading text-lg font-semibold text-glomalin-text">Basis Quotes</h1>
        <button
          onClick={() => setLogOpen(true)}
          className="bg-glomalin-accent text-glomalin-bg font-mono font-semibold text-sm rounded px-4 py-2 hover:opacity-90 transition-opacity"
        >
          Log Quote
        </button>
      </div>

      {/* Variant filter bar */}
      <div className="flex items-center gap-2 px-4 pb-3">
        <label className="text-xs text-glomalin-muted font-mono uppercase tracking-wide">
          Variant
        </label>
        <select
          className="bg-glomalin-bg border border-glomalin-border text-glomalin-text font-mono text-sm rounded px-2 py-1.5 focus:outline-none focus:border-glomalin-accent min-w-[160px]"
          value={selectedVariantId}
          onChange={(e) => setSelectedVariantId(e.target.value)}
        >
          <option value="">All variants</option>
          {variants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.commodity ? `${v.commodity.name} — ${v.name}${v.cropYear ? ` (${v.cropYear})` : ''}` : v.name}
            </option>
          ))}
        </select>
      </div>

      {/* Table or empty state */}
      {sorted.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-2">
          <p className="text-glomalin-muted font-mono text-sm">No basis quotes logged.</p>
          <p className="text-glomalin-muted font-sans text-sm">
            Log your first quote to start tracking basis history.
          </p>
        </div>
      ) : (
        <Table>
          <TableHead>
            <TableRow hover={false}>
              <TableHeader>VARIANT</TableHeader>
              <TableHeader>BASIS ($/BU)</TableHeader>
              <TableHeader>FUTURES MONTH</TableHeader>
              <TableHeader>DATE</TableHeader>
              <TableHeader>LOCATION</TableHeader>
              <TableHeader>SOURCE</TableHeader>
              <TableHeader>CONFIDENCE</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.map((q) => {
              const basisNum = getBasisValue(q)
              const isNegative = basisNum < 0
              return (
                <TableRow
                  key={q.id}
                  className="hover:bg-glomalin-elevated/50 transition-colors"
                >
                  <TableCell className="text-glomalin-text text-sm">
                    {variantDisplayName(q)}
                  </TableCell>
                  <TableCell
                    className={`font-mono text-sm ${isNegative ? 'text-glomalin-danger' : 'text-glomalin-text'}`}
                  >
                    {basisNum.toFixed(4)}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {q.futuresMonth ?? '—'}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-glomalin-muted">
                    {formatDate(q.quoteDate ?? q.quotedAt)}
                  </TableCell>
                  <TableCell className="text-glomalin-text text-sm">
                    {q.location ?? '—'}
                  </TableCell>
                  <TableCell>
                    {q.source ? <SourceBadge source={q.source} /> : <span className="text-glomalin-muted font-mono text-xs">—</span>}
                  </TableCell>
                  <TableCell>
                    {(q.confidenceTier ?? q.confidence) ? (
                      <ConfidenceBadge tier={(q.confidenceTier ?? q.confidence)!} />
                    ) : (
                      <span className="text-glomalin-muted font-mono text-xs">—</span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      {/* BasisQuoteForm drawer */}
      {logOpen && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setLogOpen(false)}
          />
          {/* Panel */}
          <div className="fixed right-0 top-0 h-full w-[480px] bg-glomalin-surface border-l border-glomalin-border overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-glomalin-border">
              <h2 className="font-mono text-glomalin-text font-semibold">Log Basis Quote</h2>
              <button
                onClick={() => setLogOpen(false)}
                className="text-glomalin-muted hover:text-glomalin-text font-mono text-lg leading-none font-semibold"
                aria-label="Close drawer"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              <BasisQuoteForm
                variants={variants}
                onSuccess={() => {
                  setLogOpen(false)
                  window.location.reload()
                }}
                open={logOpen}
                onClose={() => setLogOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
