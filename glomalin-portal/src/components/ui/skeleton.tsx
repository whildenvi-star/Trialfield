import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded bg-glomalin-border/40', className)}
    />
  )
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-glomalin-surface border border-glomalin-border rounded-lg p-4 space-y-3',
        className
      )}
    >
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-7 w-28" />
      <Skeleton className="h-3 w-14" />
    </div>
  )
}

export function SkeletonRow({ cols = 4, className }: { cols?: number; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 px-3 py-2', className)}>
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-4 flex-1" />
      ))}
    </div>
  )
}
