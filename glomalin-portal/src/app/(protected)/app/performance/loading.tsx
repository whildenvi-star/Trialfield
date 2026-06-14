function Block({ w = 'w-full', h = 'h-4' }: { w?: string; h?: string }) {
  return <div className={`${h} ${w} bg-glomalin-border rounded animate-pulse`} />
}

export default function PerformanceLoading() {
  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Block w="w-48" h="h-6" />
          <Block w="w-32" h="h-3" />
        </div>
        <Block w="w-24" h="h-8" />
      </div>

      {/* Stat cards */}
      <section className="space-y-3">
        <Block w="w-36" h="h-3" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-glomalin-surface border border-glomalin-border rounded p-4 space-y-2">
              <Block w="w-20" h="h-3" />
              <Block w="w-16" h="h-7" />
              <Block w="w-24" h="h-3" />
            </div>
          ))}
        </div>
      </section>

      {/* Marketing block */}
      <section className="space-y-3">
        <Block w="w-32" h="h-3" />
        <div className="bg-glomalin-surface border border-glomalin-border rounded overflow-hidden">
          <div className="px-4 py-3 border-b border-glomalin-border flex justify-between">
            <Block w="w-24" h="h-3" />
            <Block w="w-10" h="h-3" />
          </div>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="px-4 py-3 border-b border-glomalin-border last:border-0 space-y-2">
              <div className="flex justify-between">
                <Block w="w-24" h="h-3" />
                <Block w="w-20" h="h-3" />
              </div>
              <Block w="w-full" h="h-1.5" />
            </div>
          ))}
        </div>
      </section>

      {/* Compliance cards */}
      <section className="space-y-3">
        <Block w="w-40" h="h-3" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-glomalin-surface border border-glomalin-border rounded p-4 space-y-2">
              <Block w="w-28" h="h-3" />
              <Block w="w-16" h="h-5" />
              <Block w="w-full" h="h-3" />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
