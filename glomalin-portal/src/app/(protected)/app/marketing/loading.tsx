import { KpiStrip } from '@/components/ui/kpi-strip'
import { SkeletonCard, SkeletonRow } from '@/components/ui/skeleton'
import { Card, CardHeader, CardContent } from '@/components/ui/card'

function Block({ w = 'w-full', h = 'h-4' }: { w?: string; h?: string }) {
  return <div className={`${h} ${w} bg-glomalin-border rounded animate-pulse`} />
}

export default function MarketingLoading() {
  return (
    <div className="p-4 md:p-6 max-w-6xl space-y-6">
      {/* Header skeleton */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <Block w="w-56" h="h-6" />
          <Block w="w-28" h="h-3" />
        </div>
        <Block w="w-24" h="h-8" />
      </div>

      {/* Position strip skeleton — 4 KPI cards */}
      <KpiStrip cols={4}>
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </KpiStrip>

      {/* Section header skeleton */}
      <div className="flex items-center justify-between">
        <Block w="w-24" h="h-4" />
        <Block w="w-28" h="h-7" />
      </div>

      {/* Contract table skeleton — 6 rows, 9 columns */}
      <div className="rounded border border-glomalin-border overflow-hidden">
        <div className="bg-glomalin-surface px-3 py-2 border-b border-glomalin-border">
          <SkeletonRow cols={9} />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="px-3 py-3 border-b border-glomalin-border last:border-0">
            <SkeletonRow cols={9} />
          </div>
        ))}
      </div>

      {/* Lower section skeleton — two panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[0, 1].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Block w="w-32" h="h-4" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <SkeletonRow key={j} cols={3} />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
