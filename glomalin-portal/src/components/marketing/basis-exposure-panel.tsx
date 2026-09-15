import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Empty } from '@/components/ui/empty'
import { formatBu } from '@/lib/fmt'

interface GrainContractRow {
  id: string
  instrument:
    | 'PRICED'
    | 'SPOT'
    | 'FOB'
    | 'PRICED_LATER'
    | 'BASIS_FIXED'
    | 'FUTURES_FIXED'
    | 'MIN_PRICE'
    | 'ACCUMULATOR'
  contractedBushels: number
  appliedBushels: number
  futuresPrice?: number | null
  basis?: number | null
  finalCashPrice?: number | null
  cropYear: number
  deliveryStart?: string | null
  deliveryEnd?: string | null
  customer: { id: string; name: string; shortCode: string }
  variant: { id: string; name: string }
  status: 'OPEN' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED' | 'EXPIRED'
  htaDetails?: { futuresMonth?: string | null } | null
}

interface BasisExposurePanelProps {
  contracts: GrainContractRow[]
}

const MONTH_INDEX: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
}

function prevWeekday(d: Date): Date {
  const out = new Date(d)
  do {
    out.setDate(out.getDate() - 1)
  } while (out.getDay() === 0 || out.getDay() === 6)
  return out
}

/**
 * Approximate auto-roll deadline for an unpriced HTA: elevator terms roll the
 * contract 2 business days before first notice day of its futures month, and
 * first notice day for CBOT grains is the last business day before the 1st of
 * the contract month. Weekday math only (no exchange holiday calendar), so
 * callers should present it as approximate.
 */
export function rollDeadline(futuresMonth: string | null | undefined): Date | null {
  if (!futuresMonth) return null
  const m = /^([A-Z][a-z]{2})\s+(\d{4})$/.exec(futuresMonth.trim())
  if (!m || !(m[1] in MONTH_INDEX)) return null
  const firstNotice = prevWeekday(new Date(Number(m[2]), MONTH_INDEX[m[1]], 1))
  return prevWeekday(prevWeekday(firstNotice))
}

const MS_PER_DAY = 86_400_000

function fmtDeadline(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function BasisExposurePanel({ contracts }: BasisExposurePanelProps) {
  const now = new Date()
  const exposed = contracts
    .filter(
      (c) =>
        (c.instrument === 'FUTURES_FIXED' && c.basis == null) ||       // HTA: futures locked, basis still open
        (c.instrument === 'BASIS_FIXED' && c.futuresPrice == null)     // Basis-fixed: basis locked, futures still open
    )
    .map((c) => ({ contract: c, deadline: rollDeadline(c.htaDetails?.futuresMonth) }))
    // soonest forced-roll first; legs with no futures month recorded sink to the bottom
    .sort((a, b) => (a.deadline?.getTime() ?? Infinity) - (b.deadline?.getTime() ?? Infinity))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Basis Exposure</CardTitle>
        {exposed.length > 0 && (
          <CardDescription>
            {exposed.length} contract{exposed.length !== 1 ? 's' : ''} with open pricing leg
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {exposed.length === 0 ? (
          <Empty
            title="No open pricing legs"
            description="All HTA and basis-fixed contracts have been priced."
          />
        ) : (
          <div className="divide-y divide-glomalin-border/40">
            {exposed.map(({ contract: c, deadline }) => {
              const daysOut =
                deadline != null ? Math.ceil((deadline.getTime() - now.getTime()) / MS_PER_DAY) : null
              return (
                <div key={c.id} className="flex items-center justify-between py-2 gap-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="info">
                      {c.instrument === 'FUTURES_FIXED' ? 'HTA' : 'BASIS'}
                    </Badge>
                    <span className="font-sans text-sm text-glomalin-text truncate">
                      {c.customer.shortCode}
                    </span>
                    <span className="font-sans text-sm text-glomalin-muted truncate">
                      {c.variant.name}
                    </span>
                    {c.htaDetails?.futuresMonth && (
                      <span className="font-mono text-xs text-glomalin-muted shrink-0">
                        {c.htaDetails.futuresMonth}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-right">
                    <span className="font-mono text-sm text-glomalin-text">
                      {formatBu(c.contractedBushels)}
                    </span>
                    {deadline != null && daysOut != null && (
                      daysOut <= 30 ? (
                        <Badge variant="warning">
                          {daysOut < 0 ? 'roll passed' : `roll ~${fmtDeadline(deadline)}`}
                        </Badge>
                      ) : (
                        <span className="font-mono text-xs text-glomalin-muted">
                          roll ~{fmtDeadline(deadline)}
                        </span>
                      )
                    )}
                    {c.deliveryEnd && (
                      <span className="font-mono text-xs text-glomalin-muted">
                        del.{' '}
                        {new Date(c.deliveryEnd).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
