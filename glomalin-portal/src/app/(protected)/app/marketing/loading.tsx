function Block({ w = 'w-full', h = 'h-4' }: { w?: string; h?: string }) {
  return <div className={`${h} ${w} bg-glomalin-border rounded animate-pulse`} />
}

export default function MarketingLoading() {
  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Block w="w-44" h="h-6" />
          <Block w="w-28" h="h-3" />
        </div>
        <Block w="w-24" h="h-8" />
      </div>

      {/* CBOT price strip */}
      <section className="space-y-3">
        <Block w="w-32" h="h-3" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-glomalin-surface border border-glomalin-border rounded p-4 space-y-2">
              <Block w="w-16" h="h-3" />
              <Block w="w-20" h="h-6" />
              <Block w="w-12" h="h-3" />
            </div>
          ))}
        </div>
      </section>

      {/* Marketing positions */}
      <section className="space-y-3">
        <Block w="w-40" h="h-3" />
        {Array.from({ length: 2 }).map((_, ci) => (
          <div key={ci} className="bg-glomalin-surface border border-glomalin-border rounded overflow-hidden">
            <div className="px-4 py-3 border-b border-glomalin-border flex justify-between items-center">
              <Block w="w-24" h="h-4" />
              <Block w="w-16" h="h-3" />
            </div>
            {Array.from({ length: 3 }).map((_, ri) => (
              <div key={ri} className="px-4 py-3 border-b border-glomalin-border last:border-0 grid grid-cols-4 gap-4 items-center">
                <Block w="w-full" h="h-3" />
                <Block w="w-full" h="h-3" />
                <Block w="w-full" h="h-3" />
                <Block w="w-full" h="h-3" />
              </div>
            ))}
          </div>
        ))}
      </section>
    </div>
  )
}
