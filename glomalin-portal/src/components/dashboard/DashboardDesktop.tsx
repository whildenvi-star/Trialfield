'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'

interface DashboardDesktopProps {
  children: React.ReactNode  // FieldMap, passed from server component
  farmName?: string
}

export function DashboardDesktop({ children, farmName = 'W. HUGHES FARMS' }: DashboardDesktopProps) {
  const [actionCount, setActionCount] = useState(0)

  useEffect(() => {
    fetch('/api/dashboard/action-items')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.totalCount) setActionCount(d.totalCount) })
      .catch(() => {})
  }, [])

  return (
    <>
      {/* Full-screen field map — sits behind the identity card */}
      <div
        className="fixed inset-0 z-0"
        style={{ left: 'var(--sidebar-w)', transition: 'left 300ms cubic-bezier(0.4,0,0.2,1)' }}
      >
        {children}
      </div>

      {/* Farm identity card — compact overlay; navigation lives in the sidebar */}
      <div
        className="fixed top-6 z-10 w-64"
        style={{ left: 'calc(var(--sidebar-w) + 1.5rem)', transition: 'left 300ms cubic-bezier(0.4,0,0.2,1)' }}
      >
        <div className="rounded-lg bg-glomalin-surface/95 backdrop-blur-md border border-glomalin-border/60 shadow-lg overflow-hidden">
          <div className="px-5 pt-5 pb-4">
            <p className="text-[10px] font-mono font-medium uppercase tracking-widest text-glomalin-muted mb-1">
              Portal
            </p>
            <h1 className="text-sm font-mono font-bold text-glomalin-text tracking-wide">
              {farmName}
            </h1>
            {actionCount > 0 && (
              <Link
                href="/app/compliance"
                className="inline-flex items-center gap-1.5 mt-2 text-[11px] font-mono text-amber-400 hover:text-amber-300 transition-colors"
              >
                <span aria-hidden="true">⚠</span>
                {actionCount} item{actionCount !== 1 ? 's' : ''} need{actionCount === 1 ? 's' : ''} attention
              </Link>
            )}
          </div>

          {/* Search hint */}
          <div className="border-t border-glomalin-border/60 px-5 py-3">
            <div className="flex items-center gap-2 text-[11px] font-mono text-glomalin-muted/70">
              <kbd className="border border-glomalin-border rounded px-1.5 py-0.5 text-[10px]">⌘K</kbd>
              <span>quick search</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
