import { Suspense } from 'react'
import { fetchRegistryService } from '@/app/api/mobile/_lib/proxy'
import { FieldTimelineClient } from './field-timeline-client'
import type { RegistryField } from '@/components/timeline/field-list'

export default async function FieldTimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ field?: string }>
}) {
  const { field: initialFieldId } = await searchParams

  let fields: RegistryField[] = []
  let fetchError = false

  try {
    const res = await fetchRegistryService('/api/fields?active=true')
    if (res.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any[] = await res.json()
      if (Array.isArray(data)) {
        fields = data.map((f) => ({
          id: String(f.id ?? ''),
          name: String(f.name ?? ''),
          aliases: Array.isArray(f.aliases) ? f.aliases.map(String) : [],
          reportingAcres: Number(f.reportingAcres) || 0,
        }))
      }
    } else {
      fetchError = true
    }
  } catch {
    fetchError = true
  }

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-56px)] md:h-screen bg-glomalin-bg text-glomalin-text overflow-hidden">
      {/* Header strip */}
      <div className="sr-only">Field Activity Timeline</div>

      {fetchError ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="rounded border border-glomalin-border bg-glomalin-surface px-8 py-10 text-center max-w-md">
            <p className="text-glomalin-accent font-mono text-sm font-semibold mb-2">
              Registry Unavailable
            </p>
            <p className="text-glomalin-muted font-mono text-sm">
              Could not load field list from farm-registry. Ensure the registry
              service is running on port 3005.
            </p>
          </div>
        </div>
      ) : (
        // Suspense required: FieldTimelineClient uses useRouter/useSearchParams
        <Suspense fallback={null}>
          <FieldTimelineClient
            fields={fields}
            initialFieldId={initialFieldId ?? null}
          />
        </Suspense>
      )}
    </div>
  )
}
