'use client'

import { openCommandPalette } from '@/lib/palette-bus'

/**
 * The canvas's front door: a floating search pill in the top-left corner.
 *
 * It is the recognition-shaped twin of ⌘K — the same palette, reachable with a
 * finger. Every map-first product converges on this position (Google Maps,
 * Windy, Flightradar24) because search *is* the navigation once there is no
 * menu bar to hold it.
 */
export function CanvasSearchPill() {
  return (
    <button
      type="button"
      onClick={() => openCommandPalette()}
      className={[
        'group flex items-center gap-2.5 h-10 pl-3 pr-2 rounded-full',
        'bg-glomalin-canvas-bg/85 backdrop-blur-md',
        'border border-glomalin-canvas-border hover:border-glomalin-canvas-muted',
        'text-glomalin-canvas-muted hover:text-glomalin-canvas-text',
        'shadow-lg transition-colors touch-manipulation',
        'w-[min(320px,calc(100vw-7rem))]',
      ].join(' ')}
      aria-label="Search fields, contracts and modules"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none"
        stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
        className="w-4 h-4 flex-shrink-0" aria-hidden="true"
      >
        <circle cx="6.5" cy="6.5" r="4.5" />
        <line x1="10" y1="10" x2="14" y2="14" />
      </svg>
      <span className="flex-1 text-left text-sm font-sans truncate">
        Search fields, contracts…
      </span>
      <kbd className="hidden sm:flex flex-shrink-0 items-center text-[10px] font-mono border border-glomalin-canvas-border rounded px-1.5 py-0.5">
        ⌘K
      </kbd>
    </button>
  )
}
