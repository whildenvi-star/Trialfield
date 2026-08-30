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

  return (
    <header className="sticky top-0 z-40 h-14 bg-glomalin-bg border-b border-glomalin-border flex items-center gap-3 px-4">
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
