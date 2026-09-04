'use client'

import { usePathname } from 'next/navigation'
import { resolveRouteTitle } from '@/lib/modules'
import { openCommandPalette } from '@/lib/palette-bus'

interface MobileHeaderProps {
  /** Override the derived title. Omit to name the current route. */
  pageTitle?: string
}

export function MobileHeader({ pageTitle }: MobileHeaderProps) {
  const pathname = usePathname()
  const title = pageTitle ?? resolveRouteTitle(pathname)

  // The canvas is full-bleed and carries its own floating search pill; a sticky
  // header there would just re-frame the map from the top.
  if (pathname.startsWith('/app/maps')) return null

  return (
    // The status bar is black-translucent, so it overlays this header. Grow the
    // box by the top inset and pad the content down out from under the clock.
    <header
      className="sticky top-0 z-40 bg-glomalin-bg border-b border-glomalin-border flex items-center gap-3"
      style={{
        height: 'calc(3.5rem + var(--safe-top))',
        paddingTop: 'var(--safe-top)',
        paddingLeft: 'calc(1rem + var(--safe-left))',
        paddingRight: 'calc(1rem + var(--safe-right))',
      }}
    >
      <span className="text-xs font-mono font-bold text-glomalin-accent select-none flex-shrink-0">
        W. HUGHES
      </span>

      <h1 className="flex-1 text-sm font-mono text-glomalin-text truncate text-right">
        {title}
      </h1>

      {/* Touch path into the command palette — ⌘K does not exist on a phone. */}
      <button
        type="button"
        onClick={() => openCommandPalette()}
        aria-label="Search fields and modules"
        className="flex-shrink-0 -mr-1 w-10 h-10 flex items-center justify-center text-glomalin-muted active:text-glomalin-accent touch-manipulation"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-[18px] h-[18px]"
          aria-hidden="true"
        >
          <circle cx="6.5" cy="6.5" r="4.5" />
          <line x1="10" y1="10" x2="14" y2="14" />
        </svg>
      </button>
    </header>
  )
}
