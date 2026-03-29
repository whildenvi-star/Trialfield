'use client'

import { useState } from 'react'

export interface RegistryField {
  id: string
  name: string
  aliases: string[]
  reportingAcres: number
}

interface FieldListProps {
  fields: RegistryField[]
  onSelectField: (fieldId: string) => void
  selectedFieldId: string | null
}

export function FieldList({ fields, onSelectField, selectedFieldId }: FieldListProps) {
  const [search, setSearch] = useState('')

  const query = search.trim().toLowerCase()
  const filtered = fields
    .filter((f) => {
      if (!query) return true
      if (f.name.toLowerCase().includes(query)) return true
      if (f.aliases.some((a) => a.toLowerCase().includes(query))) return true
      return false
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="flex flex-col h-full">
      {/* Search input */}
      <div className="p-3 border-b border-glomalin-border">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search fields..."
          className="w-full bg-glomalin-bg border border-glomalin-border rounded px-3 py-2 text-sm font-mono text-glomalin-text placeholder-glomalin-muted focus:outline-none focus:border-glomalin-accent"
        />
      </div>

      {/* Field list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-glomalin-muted font-mono">
            No fields match &ldquo;{search}&rdquo;
          </div>
        ) : (
          <ul>
            {filtered.map((field) => {
              const isSelected = field.id === selectedFieldId
              return (
                <li key={field.id}>
                  <button
                    onClick={() => onSelectField(field.id)}
                    className={[
                      'w-full text-left px-4 py-3 border-l-2 transition-colors',
                      'bg-glomalin-surface hover:bg-glomalin-bg',
                      'border-b border-glomalin-border',
                      isSelected
                        ? 'border-l-glomalin-accent'
                        : 'border-l-transparent',
                    ].join(' ')}
                  >
                    <p className={`text-sm font-mono font-semibold ${isSelected ? 'text-glomalin-accent' : 'text-glomalin-text'}`}>
                      {field.name}
                    </p>
                    {field.aliases.length > 0 && (
                      <p className="text-xs font-mono text-glomalin-muted mt-0.5 truncate">
                        {field.aliases.join(', ')}
                      </p>
                    )}
                    <p className="text-xs font-mono text-glomalin-muted mt-0.5">
                      {field.reportingAcres.toLocaleString('en-US', {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}{' '}
                      ac
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Footer count */}
      <div className="px-4 py-2 border-t border-glomalin-border text-xs font-mono text-glomalin-muted">
        {filtered.length} of {fields.length} fields
      </div>
    </div>
  )
}
