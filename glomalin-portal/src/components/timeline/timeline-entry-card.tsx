'use client'

import type { TimelineEntry } from '@/lib/timeline/types'

interface TimelineEntryCardProps {
  entry: TimelineEntry
  isExpanded: boolean
  onToggle: () => void
  pairedEntry: TimelineEntry | null
  sourceColor: string
}

const SOURCE_LABELS: Record<string, string> = {
  budget: 'Budget',
  cert: 'Organic',
  fieldops: 'FieldOps',
  grain: 'Grain',
}

const STATUS_COLORS: Record<string, string> = {
  planned: 'text-glomalin-accent',
  confirmed: 'text-glomalin-green',
  completed: 'text-glomalin-green',
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr || dateStr === '9999-12-31') return 'Planned'
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtFullDate(dateStr: string | null): string {
  if (!dateStr || dateStr === '9999-12-31') return 'No date scheduled'
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// ── Source-specific detail renderers ──

function BudgetDetail({ detail }: { detail: Record<string, unknown> }) {
  const products = detail.products as Array<{ name: string; rate: number; unit: string }> | undefined
  const acres = detail.plannedAcres as number | undefined

  return (
    <div className="space-y-3">
      {typeof acres === 'number' && (
        <p className="text-xs font-mono text-glomalin-muted">
          Planned acres:{' '}
          <span className="text-glomalin-text">
            {acres.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </span>
        </p>
      )}
      {products && products.length > 0 && (
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-glomalin-muted border-b border-glomalin-border">
              <th className="text-left pb-1">Product</th>
              <th className="text-right pb-1">Rate</th>
              <th className="text-right pb-1">Unit</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, i) => (
              <tr key={i} className="border-b border-glomalin-border last:border-0">
                <td className="py-1 text-glomalin-text">{p.name}</td>
                <td className="py-1 text-right text-glomalin-text">{p.rate}</td>
                <td className="py-1 text-right text-glomalin-muted">{p.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function CertDetail({ detail }: { detail: Record<string, unknown> }) {
  const operator = detail.operator != null ? String(detail.operator) : null
  const equipment = detail.equipment != null ? String(detail.equipment) : null
  const passStatus = detail.passStatus != null ? String(detail.passStatus) : null
  const description = detail.description != null ? String(detail.description) : null
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs font-mono">
      {operator && (
        <>
          <span className="text-glomalin-muted">Operator</span>
          <span className="text-glomalin-text">{operator}</span>
        </>
      )}
      {detail.acres != null && (
        <>
          <span className="text-glomalin-muted">Acres worked</span>
          <span className="text-glomalin-text">
            {Number(detail.acres).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </span>
        </>
      )}
      {equipment && (
        <>
          <span className="text-glomalin-muted">Equipment</span>
          <span className="text-glomalin-text">{equipment}</span>
        </>
      )}
      {passStatus && (
        <>
          <span className="text-glomalin-muted">Pass status</span>
          <span className="text-glomalin-text capitalize">{passStatus}</span>
        </>
      )}
      {description && (
        <>
          <span className="text-glomalin-muted">Notes</span>
          <span className="text-glomalin-text">{description}</span>
        </>
      )}
      {detail.costPerAcre != null && (
        <>
          <span className="text-glomalin-muted">Cost/acre</span>
          <span className="text-glomalin-text">
            ${Number(detail.costPerAcre).toFixed(2)}
          </span>
        </>
      )}
    </div>
  )
}

function FieldOpsDetail({ detail }: { detail: Record<string, unknown> }) {
  const products = detail.products as Array<Record<string, unknown>> | undefined
  const machineName = detail.machineName != null ? String(detail.machineName) : null
  const rawOperationType = detail.rawOperationType != null ? String(detail.rawOperationType) : null

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs font-mono">
        {machineName && (
          <>
            <span className="text-glomalin-muted">Machine</span>
            <span className="text-glomalin-text">{machineName}</span>
          </>
        )}
        {detail.acresWorked != null && (
          <>
            <span className="text-glomalin-muted">Acres worked</span>
            <span className="text-glomalin-text">
              {Number(detail.acresWorked).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
          </>
        )}
        {rawOperationType && (
          <>
            <span className="text-glomalin-muted">Operation type</span>
            <span className="text-glomalin-text">{rawOperationType}</span>
          </>
        )}
      </div>
      {products && products.length > 0 && (
        <div>
          <p className="text-xs font-mono text-glomalin-muted mb-1">Products applied</p>
          <ul className="space-y-0.5">
            {products.map((p, i) => (
              <li key={i} className="text-xs font-mono text-glomalin-text">
                {String(p.name ?? '')}
                {p.rate != null && (
                  <span className="text-glomalin-muted ml-1">
                    @ {String(p.rate)} {String(p.unit ?? '')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function GrainDetail({ detail }: { detail: Record<string, unknown> }) {
  const netWeight = detail.netWeight as number | undefined
  const bushels =
    typeof netWeight === 'number' && typeof detail.testWeight === 'number'
      ? (netWeight / (detail.testWeight as number)).toFixed(1)
      : typeof netWeight === 'number'
      ? (netWeight / 56).toFixed(1) // default bushel weight
      : null
  const ticketNumber = detail.ticketNumber != null ? String(detail.ticketNumber) : null
  const buyer = detail.buyer != null ? String(detail.buyer) : null
  const hbtBin = detail.hbtBin != null ? String(detail.hbtBin) : null

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs font-mono">
      {ticketNumber && (
        <>
          <span className="text-glomalin-muted">Ticket #</span>
          <span className="text-glomalin-text">{ticketNumber}</span>
        </>
      )}
      {netWeight != null && (
        <>
          <span className="text-glomalin-muted">Net weight</span>
          <span className="text-glomalin-text">
            {netWeight.toLocaleString('en-US')} lbs
          </span>
        </>
      )}
      {bushels && (
        <>
          <span className="text-glomalin-muted">Bushels</span>
          <span className="text-glomalin-text">{Number(bushels).toLocaleString('en-US')}</span>
        </>
      )}
      {detail.moisture != null && (
        <>
          <span className="text-glomalin-muted">Moisture</span>
          <span className="text-glomalin-text">{Number(detail.moisture).toFixed(1)}%</span>
        </>
      )}
      {buyer && (
        <>
          <span className="text-glomalin-muted">Buyer</span>
          <span className="text-glomalin-text">{buyer}</span>
        </>
      )}
      {hbtBin && (
        <>
          <span className="text-glomalin-muted">HBT bin</span>
          <span className="text-glomalin-text">{hbtBin}</span>
        </>
      )}
    </div>
  )
}

// ── Paired comparison panel ──

function PairedComparison({
  planned,
  actual,
}: {
  planned: TimelineEntry
  actual: TimelineEntry
}) {
  const pDetail = planned.detail
  const aDetail = actual.detail

  const pProducts = pDetail.products as Array<{ name: string; rate: number; unit: string }> | undefined
  const aProducts = aDetail.products as Array<{ name: string; rate: number; unit: string }> | undefined

  const pAcres = typeof pDetail.plannedAcres === 'number' ? pDetail.plannedAcres : null
  const aAcres = typeof aDetail.acres === 'number' ? aDetail.acres : null

  return (
    <div className="mt-3 border border-glomalin-border rounded p-3">
      <p className="text-xs font-mono font-semibold text-glomalin-muted mb-2 uppercase tracking-wider">
        Planned vs Actual
      </p>
      <div className="grid grid-cols-2 gap-4">
        {/* Planned (budget) */}
        <div>
          <p className="text-xs font-mono text-glomalin-accent font-semibold mb-1">Planned</p>
          {pAcres != null && (
            <p className="text-xs font-mono text-glomalin-muted">
              Acres:{' '}
              <span
                className={pAcres !== aAcres && aAcres != null ? 'text-glomalin-accent' : 'text-glomalin-text'}
              >
                {pAcres.toFixed(1)}
              </span>
            </p>
          )}
          {pProducts && (
            <ul className="mt-1 space-y-0.5">
              {pProducts.map((p, i) => {
                const aMatch = aProducts?.find((ap) => ap.name === p.name)
                const rateDiffers = aMatch && aMatch.rate !== p.rate
                return (
                  <li key={i} className="text-xs font-mono">
                    <span className="text-glomalin-text">{p.name}</span>{' '}
                    <span className={rateDiffers ? 'text-glomalin-accent' : 'text-glomalin-muted'}>
                      {p.rate} {p.unit}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Actual (cert) */}
        <div>
          <p className="text-xs font-mono text-glomalin-green font-semibold mb-1">Actual</p>
          {aAcres != null && (
            <p className="text-xs font-mono text-glomalin-muted">
              Acres:{' '}
              <span
                className={pAcres !== aAcres && pAcres != null ? 'text-glomalin-green' : 'text-glomalin-text'}
              >
                {aAcres.toFixed(1)}
              </span>
            </p>
          )}
          {aProducts && (
            <ul className="mt-1 space-y-0.5">
              {aProducts.map((p, i) => {
                const pMatch = pProducts?.find((pp) => pp.name === p.name)
                const rateDiffers = pMatch && pMatch.rate !== p.rate
                return (
                  <li key={i} className="text-xs font-mono">
                    <span className="text-glomalin-text">{p.name}</span>{' '}
                    <span className={rateDiffers ? 'text-glomalin-green' : 'text-glomalin-muted'}>
                      {p.rate} {p.unit}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main card component ──

export function TimelineEntryCard({
  entry,
  isExpanded,
  onToggle,
  pairedEntry,
  sourceColor,
}: TimelineEntryCardProps) {
  const statusColor = entry.status ? (STATUS_COLORS[entry.status] ?? 'text-glomalin-muted') : ''

  // Determine paired roles
  const plannedEntry = entry.source === 'budget' ? entry : pairedEntry?.source === 'budget' ? pairedEntry : null
  const actualEntry = entry.source === 'cert' ? entry : pairedEntry?.source === 'cert' ? pairedEntry : null
  const showComparison = isExpanded && pairedEntry !== null && plannedEntry && actualEntry

  return (
    <div
      className="border border-glomalin-border rounded overflow-hidden transition-all"
      style={{ borderLeftWidth: '4px', borderLeftColor: sourceColor }}
    >
      {/* Collapsed header — always visible */}
      <button
        onClick={onToggle}
        className="w-full text-left flex items-center gap-3 px-4 py-3 bg-glomalin-surface hover:bg-glomalin-bg transition-colors"
      >
        {/* Date */}
        <span className="text-xs font-mono text-glomalin-muted w-16 flex-shrink-0">
          {fmtDate(entry.date)}
        </span>

        {/* Source badge */}
        <span
          className="text-xs font-mono px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ backgroundColor: sourceColor + '22', color: sourceColor }}
        >
          {SOURCE_LABELS[entry.source] ?? entry.source}
        </span>

        {/* Activity type */}
        <span className="text-xs font-mono text-glomalin-muted flex-shrink-0">
          {entry.activityType}
        </span>

        {/* Summary */}
        <span className="flex-1 text-sm font-mono text-glomalin-text truncate">
          {entry.summary}
        </span>

        {/* Status badge */}
        {entry.status && (
          <span className={`text-xs font-mono flex-shrink-0 capitalize ${statusColor}`}>
            {entry.status}
          </span>
        )}

        {/* Expand/collapse indicator */}
        <span className="text-glomalin-muted flex-shrink-0 ml-1">
          {isExpanded ? '▲' : '▼'}
        </span>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-3 bg-glomalin-bg border-t border-glomalin-border">
          {/* Full date */}
          <p className="text-xs font-mono text-glomalin-muted mb-3">{fmtFullDate(entry.date)}</p>

          {/* Source-specific detail */}
          {entry.source === 'budget' && <BudgetDetail detail={entry.detail} />}
          {entry.source === 'cert' && <CertDetail detail={entry.detail} />}
          {entry.source === 'fieldops' && <FieldOpsDetail detail={entry.detail} />}
          {entry.source === 'grain' && <GrainDetail detail={entry.detail} />}

          {/* Paired comparison */}
          {showComparison && (
            <PairedComparison planned={plannedEntry!} actual={actualEntry!} />
          )}

          {/* Source link */}
          {entry.sourceLink && (
            <div className="mt-3 pt-3 border-t border-glomalin-border">
              <a
                href={entry.sourceLink}
                className="text-xs font-mono text-glomalin-accent hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                View in {SOURCE_LABELS[entry.source] ?? entry.source} &rarr;
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
