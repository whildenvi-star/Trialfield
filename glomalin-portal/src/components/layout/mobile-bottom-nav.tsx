'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MODULES } from '@/lib/modules'

interface MobileBottomNavProps {
  grantedModuleIds: string[]
}

const MAIN_TABS = [
  { label: 'Home',         href: '/dashboard',          action: undefined,      icon: 'home'  as const },
  { label: 'Farm Info',    href: '/app/field-history',  action: undefined,      icon: 'field' as const },
  { label: 'Field Passes', href: '/app/field-ops',      action: undefined,      icon: 'check' as const },
  { label: 'More',         href: undefined,             action: 'more' as const, icon: 'grid'  as const },
]

const MAIN_TAB_HREFS = new Set(['/dashboard', '/app/field-history', '/app/field-ops'])

// Inline SVG icons — 24x24, stroke-based, no fill, consistent with SideNav hamburger pattern
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 9.75L12 3l9 6.75V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.75Z" />
      <path d="M9 22V12h6v10" />
    </svg>
  )
}

function FieldIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </svg>
  )
}

function GridIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="5" cy="5" r="1.5" />
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="19" cy="5" r="1.5" />
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
      <circle cx="5" cy="19" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
      <circle cx="19" cy="19" r="1.5" />
    </svg>
  )
}

function TabIcon({ icon, className }: { icon: 'home' | 'field' | 'check' | 'grid'; className?: string }) {
  switch (icon) {
    case 'home':  return <HomeIcon  className={className} />
    case 'field': return <FieldIcon className={className} />
    case 'check': return <CheckIcon className={className} />
    case 'grid':  return <GridIcon  className={className} />
  }
}

export function MobileBottomNav({ grantedModuleIds }: MobileBottomNavProps) {
  const pathname = usePathname()
  const [sheetOpen, setSheetOpen] = useState(false)

  // Belt-and-suspenders: ensure --sidebar-w is 0px on mobile (SideNav sets 220px on desktop)
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', '0px')
  }, [])

  // Close sheet on navigation
  useEffect(() => {
    setSheetOpen(false)
  }, [pathname])

  // Modules shown in the "More" sheet: granted + not already in main tabs
  const moreModules = MODULES.filter(
    (mod) =>
      grantedModuleIds.includes(mod.id) &&
      !MAIN_TAB_HREFS.has(mod.route) &&
      mod.route !== '/dashboard'
  )

  function isTabActive(href: string | undefined): boolean {
    if (!href) return false
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* "More" backdrop — below sheet (z-40), above content */}
      {sheetOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setSheetOpen(false)}
        />
      )}

      {/* "More" overflow sheet */}
      <div
        role="dialog"
        aria-label="More modules"
        aria-modal={sheetOpen}
        className={[
          'fixed inset-x-0 bottom-0 z-50',
          'bg-glomalin-bg border-t border-glomalin-border rounded-t-xl',
          'transition-transform duration-200',
          sheetOpen ? 'translate-y-0' : 'translate-y-full',
        ].join(' ')}
      >
        {/* Sheet header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-glomalin-border">
          <span className="text-sm font-mono font-bold text-glomalin-text">More</span>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setSheetOpen(false)}
            className="text-glomalin-muted hover:text-glomalin-text text-lg font-mono leading-none px-1"
          >
            ×
          </button>
        </div>

        {/* Module list */}
        <div className="overflow-y-auto max-h-[60vh] pb-[56px]">
          {moreModules.length === 0 ? (
            <p className="px-4 py-6 text-sm font-mono text-glomalin-muted text-center">
              No additional modules available.
            </p>
          ) : (
            moreModules.map((mod) => (
              <Link
                key={mod.id}
                href={`/app/${mod.id}`}
                onClick={() => setSheetOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm font-mono text-glomalin-text border-b border-glomalin-border last:border-0 hover:bg-glomalin-border/40 transition-colors"
              >
                {mod.label}
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Fixed bottom tab bar */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 inset-x-0 z-50 bg-glomalin-bg border-t border-glomalin-border flex"
      >
        {MAIN_TABS.map((tab) => {
          const active = tab.action === 'more' ? sheetOpen : isTabActive(tab.href)
          const colorClass = active ? 'text-glomalin-accent' : 'text-glomalin-muted'

          if (tab.action === 'more') {
            return (
              <button
                key={tab.label}
                type="button"
                aria-label={tab.label}
                aria-expanded={sheetOpen}
                onClick={() => setSheetOpen((p) => !p)}
                className={[
                  'flex flex-col items-center justify-center flex-1 min-h-[56px] touch-manipulation',
                  colorClass,
                ].join(' ')}
              >
                <TabIcon icon={tab.icon} className="w-6 h-6" />
                <span className="text-[10px] font-mono mt-0.5">{tab.label}</span>
              </button>
            )
          }

          return (
            <Link
              key={tab.label}
              href={tab.href!}
              aria-label={tab.label}
              className={[
                'flex flex-col items-center justify-center flex-1 min-h-[56px] touch-manipulation',
                colorClass,
              ].join(' ')}
            >
              <TabIcon icon={tab.icon} className="w-6 h-6" />
              <span className="text-[10px] font-mono mt-0.5">{tab.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
