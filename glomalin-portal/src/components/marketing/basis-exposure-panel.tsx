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
}

interface BasisExposurePanelProps {
  contracts: GrainContractRow[]
}

export function BasisExposurePanel({ contracts }: BasisExposurePanelProps) {
  const exposed = contracts.filter(
    (c) =>
      (c.instrument === 'FUTURES_FIXED' &&
        (c.futuresPrice == null || c.futuresPrice === undefined)) ||
      (c.instrument === 'BASIS_FIXED' &&
        (c.basis == null || c.basis === undefined))
  )

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
            {exposed.map((c) => (
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
                </div>
                <div className="flex items-center gap-3 shrink-0 text-right">
                  <span className="font-mono text-sm text-glomalin-text">
                    {formatBu(c.contractedBushels)}
                  </span>
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
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
