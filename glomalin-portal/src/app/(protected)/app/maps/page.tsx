import { Suspense } from 'react'
import { FieldMap } from '@/components/maps/field-map'

/**
 * /app/maps — Interactive Field Map
 *
 * Server component. Renders the FieldMap client component in a full-viewport
 * container that fills below the portal's sticky top bar (h-14 = 56px).
 *
 * No initial center/zoom props — fitBounds() on the fetched field polygons
 * is the canonical initial view (per CONTEXT.md locked decision).
 */
export default async function MapsPage() {
  return (
    // fixed inset-0 top-14: fills the entire viewport below the h-14 sticky top bar
    <div className="fixed inset-0 top-14">
      <Suspense fallback={<div className="w-full h-full bg-[#080604] animate-pulse" />}>
        <FieldMap />
      </Suspense>
    </div>
  )
}
