'use client'

import { useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { FieldList } from '@/components/timeline/field-list'
import { TimelineWorkspace } from '@/components/timeline/timeline-workspace'
import type { RegistryField } from '@/components/timeline/field-list'

interface FieldTimelineClientProps {
  fields: RegistryField[]
  initialFieldId: string | null
}

export function FieldTimelineClient({ fields, initialFieldId }: FieldTimelineClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const selectedFieldId = searchParams.get('field') ?? initialFieldId

  const handleSelectField = useCallback(
    (fieldId: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('field', fieldId)
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  const selectedField = fields.find((f) => f.id === selectedFieldId) ?? null

  return (
    <div className="flex flex-col md:flex-row w-full h-full overflow-hidden">
      {/* Left panel: field list (~300px) */}
      <aside className="w-full md:w-72 flex-shrink-0 border-b md:border-b-0 md:border-r border-glomalin-border bg-glomalin-surface flex flex-col overflow-hidden max-h-48 md:max-h-none">
        <div className="px-4 py-3 border-b border-glomalin-border">
          <h1 className="text-sm font-mono font-semibold text-glomalin-text">Field Timeline</h1>
          <p className="text-xs font-mono text-glomalin-muted mt-0.5">Activity History</p>
        </div>
        <div className="flex-1 overflow-hidden">
          <FieldList
            fields={fields}
            onSelectField={handleSelectField}
            selectedFieldId={selectedFieldId}
          />
        </div>
      </aside>

      {/* Right panel: timeline workspace or landing */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {selectedField ? (
          <TimelineWorkspace
            fieldId={selectedField.id}
            fieldName={selectedField.name}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-glomalin-muted font-mono text-sm">
                Select a field to view its activity timeline
              </p>
              {fields.length === 0 && (
                <p className="text-glomalin-muted font-mono text-xs mt-2">
                  No fields available in registry.
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
