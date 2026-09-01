'use client'

import type { MapView } from './field-map'

interface ViewSwitcherProps {
  view: MapView
  onChange: (view: MapView) => void
}

const VIEWS: { id: MapView; label: string }[] = [
  { id: 'enterprise', label: 'Enterprise' },
  { id: 'fsa',        label: 'FSA Status' },
]

export function ViewSwitcher({ view, onChange }: ViewSwitcherProps) {
  return (
    <div
      className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 font-mono text-[11px] uppercase tracking-widest"
      style={{ filter: 'drop-shadow(0 2px 12px rgba(0,0,0,0.7))' }}
    >
      {VIEWS.map((v, i) => {
        const active = view === v.id
        const isFirst = i === 0
        const isLast  = i === VIEWS.length - 1
        return (
          <button
            key={v.id}
            onClick={() => onChange(v.id)}
            className={[
              'px-4 py-2 border transition-colors',
              isFirst ? 'rounded-l' : '',
              isLast  ? 'rounded-r' : '',
              !isFirst ? 'border-l-0' : '',
              active
                ? 'bg-glomalin-canvas-accent/20 border-glomalin-canvas-accent text-glomalin-canvas-accent'
                : 'bg-glomalin-canvas-surface/90 border-glomalin-canvas-border text-glomalin-canvas-muted hover:text-glomalin-canvas-text hover:border-glomalin-canvas-muted',
            ].join(' ')}
          >
            {v.label}
          </button>
        )
      })}
    </div>
  )
}
