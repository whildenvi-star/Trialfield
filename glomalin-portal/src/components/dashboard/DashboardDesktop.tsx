'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { MODULES } from '@/lib/modules'

const MODULE_GROUPS: { label: string; ids: string[] }[] = [
  { label: 'Field',      ids: ['maps', 'weather', 'field-history', 'field-timeline'] },
  { label: 'Operations', ids: ['field-ops', 'compliance', 'org-cert', 'farm-registry'] },
  { label: 'Finance',    ids: ['performance', 'enterprise-summary', 'farm-budget', 'grain-tickets'] },
  { label: 'Inputs',     ids: ['seed-inventory', 'meristem-malt'] },
]

interface DashboardDesktopProps {
  children: React.ReactNode  // FieldMap, passed from server component
  grantedModules: string[] | null
  farmName?: string
}

export function DashboardDesktop({ children, grantedModules, farmName = 'W. HUGHES FARMS' }: DashboardDesktopProps) {
  const pathname = usePathname()
  const [actionCount, setActionCount] = useState(0)

  useEffect(() => {
    fetch('/api/dashboard/action-items')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.totalCount) setActionCount(d.totalCount) })
      .catch(() => {})
  }, [])

  const visibleIds = new Set(
    MODULES
      .filter((m) => grantedModules === null || grantedModules.includes(m.id))
      .map((m) => m.id)
  )
  const moduleById = Object.fromEntries(MODULES.map((m) => [m.id, m]))

  return (
    <>
      {/* Full-screen field map — sits behind the command panel */}
      <div
        className="fixed inset-0 z-0"
        style={{ left: 'var(--sidebar-w)' }}
      >
        {children}
      </div>

      {/* Command panel — overlaid on the left edge of the content area */}
      <div
        className="fixed top-0 bottom-0 w-64 z-10 flex flex-col"
        style={{ left: 'var(--sidebar-w)' }}
      >
        <div className="flex flex-col h-full bg-glomalin-surface/95 backdrop-blur-md border-r border-glomalin-border/60">

          {/* Farm identity */}
          <div className="px-5 pt-6 pb-4 border-b border-glomalin-border/60">
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

          {/* Module groups */}
          <div className="flex-1 overflow-y-auto py-2 scrollbar-none">
            {MODULE_GROUPS.map((group) => {
              const groupMods = group.ids
                .filter((id) => visibleIds.has(id))
                .map((id) => moduleById[id])
                .filter(Boolean)

              if (groupMods.length === 0) return null

              return (
                <div key={group.label} className="mt-1">
                  <p className="px-5 pt-3 pb-1 text-[10px] font-mono font-medium uppercase tracking-widest text-glomalin-muted select-none">
                    {group.label}
                  </p>
                  {groupMods.map((mod) => {
                    const isActive = pathname.startsWith(mod.route)
                    return (
                      <Link
                        key={mod.id}
                        href={mod.route}
                        className={[
                          'relative flex items-center px-5 py-2 text-sm font-sans transition-colors duration-100',
                          isActive
                            ? 'text-glomalin-accent bg-glomalin-highlight/80'
                            : 'text-glomalin-muted hover:text-glomalin-text hover:bg-glomalin-border/30',
                        ].join(' ')}
                      >
                        {isActive && (
                          <span
                            aria-hidden="true"
                            className="absolute left-0 inset-y-1.5 w-[3px] bg-glomalin-accent rounded-r-full"
                          />
                        )}
                        {mod.label}
                      </Link>
                    )
                  })}
                </div>
              )
            })}
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
