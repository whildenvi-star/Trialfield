'use client'

interface MobileHeaderProps {
  pageTitle: string
}

export function MobileHeader({ pageTitle }: MobileHeaderProps) {
  return (
    <header className="sticky top-0 z-40 h-14 bg-glomalin-bg border-b border-glomalin-border flex items-center justify-between px-4">
      <span className="text-xs font-mono font-bold text-glomalin-accent select-none flex-shrink-0">
        W. HUGHES
      </span>
      <h1 className="text-sm font-mono text-glomalin-text truncate ml-4 text-right">
        {pageTitle}
      </h1>
    </header>
  )
}
