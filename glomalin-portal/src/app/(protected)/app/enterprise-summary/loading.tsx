function Block({ w = 'w-full', h = 'h-4' }: { w?: string; h?: string }) {
  return <div className={`${h} ${w} bg-glomalin-border rounded animate-pulse`} />
}

export default function EnterpriseSummaryLoading() {
  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Block w="w-52" h="h-6" />
          <Block w="w-36" h="h-3" />
        </div>
        <Block w="w-24" h="h-8" />
      </div>

      {/* Enterprise groups */}
      {Array.from({ length: 2 }).map((_, gi) => (
        <section key={gi} className="space-y-3">
          <div className="flex items-center justify-between">
            <Block w="w-28" h="h-4" />
            <Block w="w-20" h="h-3" />
          </div>
          {/* Table header */}
          <div className="bg-glomalin-surface border border-glomalin-border rounded overflow-hidden">
            <div className="px-4 py-2 border-b border-glomalin-border grid grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Block key={i} w="w-full" h="h-3" />
              ))}
            </div>
            {/* Table rows */}
            {Array.from({ length: 3 }).map((_, ri) => (
              <div key={ri} className="px-4 py-3 border-b border-glomalin-border last:border-0 grid grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, ci) => (
                  <Block key={ci} w="w-full" h="h-3" />
                ))}
              </div>
            ))}
            {/* Subtotal */}
            <div className="px-4 py-3 border-t border-glomalin-border bg-glomalin-highlight/30 grid grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Block key={i} w="w-full" h="h-3" />
              ))}
            </div>
          </div>
        </section>
      ))}
    </div>
  )
}
