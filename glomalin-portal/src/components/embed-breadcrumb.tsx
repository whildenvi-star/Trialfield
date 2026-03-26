'use client'

import Link from 'next/link'

interface EmbedBreadcrumbProps {
  moduleLabel: string
  moduleSublabel: string
}

export function EmbedBreadcrumb({ moduleLabel }: EmbedBreadcrumbProps) {
  return (
    <div
      className="fixed left-0 right-0 z-40 flex items-center justify-between px-4 sm:px-6 border-b border-glomalin-border bg-glomalin-surface"
      style={{
        top: 'var(--portal-header-h, 56px)',
        height: 'var(--embed-breadcrumb-h, 36px)',
      }}
    >
      {/* Left: breadcrumb path */}
      <nav className="flex items-center gap-1.5 font-mono text-xs text-glomalin-muted" aria-label="Breadcrumb">
        <Link
          href="/dashboard"
          className="text-glomalin-accent hover:underline transition-colors"
        >
          Dashboard
        </Link>
        <span className="text-glomalin-muted select-none" aria-hidden="true">
          {'>'}
        </span>
        <span className="text-glomalin-text">{moduleLabel}</span>
      </nav>

      {/* Right: back button */}
      <Link
        href="/dashboard"
        className="flex items-center gap-1 font-mono text-xs text-glomalin-muted hover:text-glomalin-accent transition-colors"
        aria-label="Back to Dashboard"
      >
        {/* Left-arrow chevron */}
        <svg
          className="w-3 h-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        <span>Back to Dashboard</span>
      </Link>
    </div>
  )
}
