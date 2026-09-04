'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MODULES, MODULE_GROUPS, PAGES } from '@/lib/modules'
import { readRecents, type RecentEntry } from '@/lib/palette-bus'

/**
 * The canvas's own navigation: a 48px icon rail that expands panels *inward*
 * over the map rather than reflowing it.
 *
 * This is what lets the map be full-bleed without anything becoming
 * unreachable. The Modules drawer carries the same grouped list the sidebar
 * had — with labels, not bare icons, because icon-only switchers stop being
 * legible past about eight entries and this one holds seventeen.
 */

type DrawerId = 'layers' | 'modules' | 'recent'

const RAIL_W = 48
const DRAWER_W = 300

interface CanvasRailProps {
  grantedModules: string[] | null
  /** Layer controls owned by the map, rendered inside the Layers drawer. */
  layersContent?: React.ReactNode
}

function Icon({ id, className }: { id: DrawerId; className?: string }) {
  const p = {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': 'true' as const,
  }
  if (id === 'layers') {
    return (
      <svg {...p}>
        <path d="M8 1.8 1.8 5 8 8.2 14.2 5 8 1.8Z" />
        <path d="M1.8 8.2 8 11.4l6.2-3.2" />
        <path d="M1.8 11.2 8 14.4l6.2-3.2" />
      </svg>
    )
  }
  if (id === 'modules') {
    return (
      <svg {...p}>
        <rect x="2" y="2" width="5" height="5" rx="1" />
        <rect x="9" y="2" width="5" height="5" rx="1" />
        <rect x="2" y="9" width="5" height="5" rx="1" />
        <rect x="9" y="9" width="5" height="5" rx="1" />
      </svg>
    )
  }
  return (
    <svg {...p}>
      <circle cx="8" cy="8" r="6.2" />
      <path d="M8 4.6V8l2.4 1.6" />
    </svg>
  )
}

export function CanvasRail({ grantedModules, layersContent }: CanvasRailProps) {
  const pathname = usePathname()
  const [openDrawer, setOpenDrawer] = useState<DrawerId | null>(null)
  const [recents, setRecents] = useState<RecentEntry[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  const granted = useCallback(
    (id: string) => grantedModules === null || grantedModules.includes(id),
    [grantedModules]
  )

  const toggle = useCallback((id: DrawerId) => {
    setOpenDrawer((cur) => {
      const next = cur === id ? null : id
      if (next === 'recent') setRecents(readRecents())
      return next
    })
  }, [])

  // Escape closes the drawer; clicking the map does too. Deliberately *not*
  // hover-to-open: this rail has to work under a finger on a tablet.
  useEffect(() => {
    if (!openDrawer) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) setOpenDrawer(null)
    }
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpenDrawer(null)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [openDrawer])

  useEffect(() => { setOpenDrawer(null) }, [pathname])

  const buttons: { id: DrawerId; label: string }[] = [
    { id: 'layers', label: 'Layers' },
    { id: 'modules', label: 'Modules' },
    { id: 'recent', label: 'Recent' },
  ]

  return (
    // Desktop only: on a phone the bottom tab bar already carries module reach,
    // and 48px of rail would just be another edge closing in on the map.
    <div ref={containerRef} className="absolute left-0 top-0 bottom-0 z-30 hidden md:flex pointer-events-none">
      {/* Rail */}
      <nav
        aria-label="Canvas navigation"
        style={{ width: RAIL_W }}
        className="pointer-events-auto flex flex-col items-center gap-1 pt-14 pb-3 bg-glomalin-canvas-bg/80 backdrop-blur-sm border-r border-glomalin-canvas-border"
      >
        {buttons.map((b) => {
          const active = openDrawer === b.id
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => toggle(b.id)}
              aria-label={b.label}
              aria-expanded={active}
              title={b.label}
              className={[
                'relative w-10 h-10 flex items-center justify-center rounded transition-colors touch-manipulation',
                active
                  ? 'text-glomalin-canvas-accent bg-glomalin-canvas-accent/10'
                  : 'text-glomalin-canvas-muted hover:text-glomalin-canvas-text hover:bg-glomalin-canvas-elevated',
              ].join(' ')}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute left-0 inset-y-2 w-[2px] rounded-r-full bg-glomalin-canvas-accent"
                />
              )}
              <Icon id={b.id} className="w-[18px] h-[18px]" />
            </button>
          )
        })}
      </nav>

      {/* Drawer — overlays the map, never reflows it */}
      {/* A closed drawer must not be in the hit-test path: it is 300px wide and
          sits directly under the search pill. `invisible` (visibility:hidden)
          takes it out of hit-testing *and* the tab order — pairing
          pointer-events-auto with pointer-events-none on one element just makes
          CSS source order decide, and the closed drawer won and ate the clicks. */}
      <div
        style={{ width: DRAWER_W }}
        className={[
          'h-full overflow-y-auto',
          'bg-glomalin-canvas-bg/95 backdrop-blur-md border-r border-glomalin-canvas-border',
          'transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none',
          openDrawer
            ? 'visible pointer-events-auto translate-x-0 opacity-100'
            : 'invisible -translate-x-3 opacity-0',
        ].join(' ')}
        aria-hidden={!openDrawer}
      >
        {openDrawer === 'layers' && (
          <Section title="Layers">
            {layersContent ?? (
              <p className="px-4 text-glomalin-canvas-muted font-mono text-xs">
                No layer controls for this view.
              </p>
            )}
          </Section>
        )}

        {openDrawer === 'modules' && (
          <Section title="Modules">
            {MODULE_GROUPS.map((group) => {
              const mods = group.ids
                .map((id) => MODULES.find((m) => m.id === id))
                .filter((m): m is NonNullable<typeof m> => !!m && granted(m.id))
              if (!mods.length) return null
              return (
                <div key={group.label} className="mb-1">
                  <p className="px-4 pt-3 pb-1 text-[10px] font-mono uppercase tracking-widest text-glomalin-canvas-muted select-none">
                    {group.label}
                  </p>
                  {mods.map((m) => (
                    <DrawerLink
                      key={m.id}
                      href={m.route}
                      label={m.label}
                      sublabel={m.sublabel}
                      active={pathname.startsWith(m.route)}
                    />
                  ))}
                </div>
              )
            })}
            <div className="mb-2">
              <p className="px-4 pt-3 pb-1 text-[10px] font-mono uppercase tracking-widest text-glomalin-canvas-muted select-none">
                Pages
              </p>
              {PAGES.filter((p) => !p.requires || granted(p.requires)).map((p) => (
                <DrawerLink
                  key={p.id}
                  href={p.route}
                  label={p.label}
                  sublabel={p.sublabel}
                  active={pathname === p.route}
                />
              ))}
            </div>
          </Section>
        )}

        {openDrawer === 'recent' && (
          <Section title="Recent">
            {recents.length === 0 ? (
              <p className="px-4 text-glomalin-canvas-muted font-mono text-xs leading-relaxed">
                Nothing yet. Fields and modules you open from search show up here.
              </p>
            ) : (
              recents.map((r) => (
                <DrawerLink
                  key={r.key}
                  href={r.route}
                  label={r.label}
                  sublabel={r.sublabel}
                  active={false}
                />
              ))
            )}
          </Section>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-3">
      <p className="px-4 pb-2 text-xs font-mono uppercase tracking-widest text-glomalin-canvas-accent">
        {title}
      </p>
      {children}
    </div>
  )
}

function DrawerLink({
  href, label, sublabel, active,
}: {
  href: string; label: string; sublabel: string; active: boolean
}) {
  return (
    <Link
      href={href}
      className={[
        'relative block px-4 py-2 transition-colors',
        active
          ? 'bg-glomalin-canvas-accent/10'
          : 'hover:bg-glomalin-canvas-elevated',
      ].join(' ')}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute left-0 inset-y-1 w-[2px] rounded-r-full bg-glomalin-canvas-accent"
        />
      )}
      <span className={[
        'block text-sm font-sans truncate',
        active ? 'text-glomalin-canvas-accent' : 'text-glomalin-canvas-text',
      ].join(' ')}>
        {label}
      </span>
      <span className="block text-[10px] font-mono text-glomalin-canvas-muted truncate mt-0.5">
        {sublabel}
      </span>
    </Link>
  )
}
