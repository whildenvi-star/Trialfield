'use client'

export interface FieldSummary {
  registry_field_id: string
  last_7d_in:        number | null
  last_30d_in:       number | null
  last_fetched:      string | null
  name?:             string
}

interface FieldListProps {
  fields:          FieldSummary[]
  selectedId:      string | null
  onSelect:        (id: string) => void
  maxLast7d:       number
}

export default function FieldList({ fields, selectedId, onSelect, maxLast7d }: FieldListProps) {
  const max = maxLast7d || 1

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-3 py-2.5 border-b border-glomalin-border shrink-0">
        <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-glomalin-muted select-none">
          Fields — 7d rain
        </p>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-none">
        {fields.length === 0 && (
          <p className="px-3 py-4 text-xs font-mono text-glomalin-muted">
            No field data. Run a refresh.
          </p>
        )}
        {fields.map((f) => {
          const inches  = f.last_7d_in ?? 0
          const pct     = Math.min((inches / max) * 100, 100)
          const active  = f.registry_field_id === selectedId

          return (
            <button
              key={f.registry_field_id}
              type="button"
              onClick={() => onSelect(f.registry_field_id)}
              className={[
                'relative w-full text-left px-3 py-2.5 transition-colors duration-100',
                'border-b border-glomalin-border/40',
                active
                  ? 'bg-glomalin-highlight text-glomalin-accent'
                  : 'text-glomalin-muted hover:text-glomalin-text hover:bg-glomalin-border/30',
              ].join(' ')}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute left-0 inset-y-1 w-[3px] bg-glomalin-accent rounded-r-full"
                />
              )}
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-mono text-xs truncate leading-tight">
                  {f.name ?? f.registry_field_id}
                </span>
                <span className={[
                  'font-mono text-xs shrink-0 tabular-nums',
                  active ? 'text-glomalin-accent' : inches > 0 ? 'text-glomalin-text' : 'text-glomalin-muted',
                ].join(' ')}>
                  {inches.toFixed(2)}&Prime;
                </span>
              </div>
              {/* Rain bar */}
              <div className="h-1 rounded overflow-hidden bg-glomalin-border/40">
                <div
                  className="h-full rounded transition-all duration-300"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: inches > 0 ? '#7A9E7E' : 'transparent',
                  }}
                />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
