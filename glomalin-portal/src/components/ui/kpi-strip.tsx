import { cn } from '@/lib/utils'

interface KpiStripProps {
  /** Number of columns at the largest breakpoint. Default: 4 */
  cols?: 2 | 3 | 4 | 5 | 6
  className?: string
  children: React.ReactNode
}

const colClasses: Record<NonNullable<KpiStripProps['cols']>, string> = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
  6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
}

/** Responsive KPI grid — 4-up desktop, 2-up tablet, 1-up mobile (default). */
export function KpiStrip({ cols = 4, className, children }: KpiStripProps) {
  return (
    <div className={cn('grid gap-3', colClasses[cols], className)}>
      {children}
    </div>
  )
}
