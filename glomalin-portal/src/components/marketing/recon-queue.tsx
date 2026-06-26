'use client'

import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Empty } from '@/components/ui/empty'
import { formatBu } from '@/lib/fmt'

interface GrainDeliveryRow {
  id: string
  deliveryDate: string  // ISO date string
  netBushels: number
  unappliedBushels: number
  customer: { id: string; name: string; shortCode: string }
  variant: { id: string; name: string }
}

interface ReconQueueProps {
  deliveries: GrainDeliveryRow[]
}

export function ReconQueue({ deliveries }: ReconQueueProps) {
  const router = useRouter()

  // Guard defensively — API already filters, but ensure only unmatched rows render
  const unmatched = deliveries.filter((d) => d.unappliedBushels > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reconciliation Queue</CardTitle>
        {unmatched.length > 0 && (
          <CardDescription>
            {unmatched.length} unmatched deliver{unmatched.length !== 1 ? 'ies' : 'y'}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {unmatched.length === 0 ? (
          <Empty
            title="Queue is clear"
            description="All deliveries have been applied to contracts."
          />
        ) : (
          <div className="divide-y divide-glomalin-border/40">
            {unmatched.map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-center justify-between py-2 gap-2"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-sans text-sm font-bold text-glomalin-text">
                    {new Date(d.deliveryDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="font-sans text-sm text-glomalin-muted">
                    {d.customer.shortCode} \u00b7 {d.variant.name}
                  </span>
                  <span className="font-mono text-xs text-glomalin-warning">
                    {formatBu(d.unappliedBushels)} unmatched
                  </span>
                </div>
                <button
                  className="px-3 py-1.5 min-h-[44px] rounded border border-glomalin-border text-xs font-mono text-glomalin-muted hover:border-glomalin-accent hover:text-glomalin-accent transition-colors ml-auto"
                  onClick={() => router.push(`/app/marketing/deliveries/${d.id}/apply`)}
                >
                  Apply
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
