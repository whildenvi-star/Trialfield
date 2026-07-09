'use client'

// Replaces toggle-only sidebar. New model: 64 px icon rail + hover-peek (overlay, no reflow)
// + click-to-pin (reflows content). Tooltips via Radix Portal escape nav overflow:hidden.

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as Tooltip from '@radix-ui/react-tooltip'
import { logout } from '@/app/actions/auth'
import { MODULES } from '@/lib/modules'
import { type SceneType, nextScene } from '@/components/layout/scene-types'

// ─── Constants ────────────────────────────────────────────────────────────────

const BANNER_KEY  = 'glomalin-banner-disabled'
const SCENE_KEY   = 'glomalin-scene'
const PINNED_KEY  = 'glomalin-sidebar-pinned'
const VALID_SCENES: SceneType[] = ['mycelium', 'drone', 'seasonal']
const RAIL_W = '64px'
const OPEN_W = '240px'

const MODULE_GROUPS: { label: string; icon: 'field' | 'ops' | 'finance' | 'inputs'; ids: string[] }[] = [
  { label: 'Field',      icon: 'field',   ids: ['maps', 'weather', 'field-history', 'field-timeline'] },
  { label: 'Operations', icon: 'ops',     ids: ['field-ops', 'compliance', 'org-cert', 'farm-registry'] },
  { label: 'Finance',    icon: 'finance', ids: ['performance', 'enterprise-summary', 'farm-budget', 'grain-tickets'] },
  { label: 'Inputs',     icon: 'inputs',  ids: ['seed-inventory', 'meristem-malt'] },
]

// ─── localStorage helpers ─────────────────────────────────────────────────────

function readPinnedPref(): boolean {
  if (typeof window === 'undefined') return false
  try { return localStorage.getItem(PINNED_KEY) === 'true' } catch { return false }
}
function readBannerPref(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const v = localStorage.getItem(BANNER_KEY)
    return v === null ? true : v === 'true'
  } catch { return true }
}
function readScenePref(): SceneType {
  if (typeof window === 'undefined') return 'mycelium'
  try {
    const s = localStorage.getItem(SCENE_KEY)
    return s && VALID_SCENES.includes(s as SceneType) ? (s as SceneType) : 'mycelium'
  } catch { return 'mycelium' }
}

// ─── SVG icons ────────────────────────────────────────────────────────────────

function RailIcon({ type, className }: { type: 'field' | 'ops' | 'finance' | 'inputs'; className?: string }) {
  const p = {
    xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 16 16', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.5,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    className, 'aria-hidden': 'true' as const,
  }
  if (type === 'field') return (
    <svg {...p}>
      <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" />
      <line x1="8" y1="1.5" x2="8" y2="14.5" />
      <line x1="1.5" y1="8" x2="14.5" y2="8" />
    </svg>
  )
  if (type === 'ops') return (
    <svg {...p}>
      <rect x="3" y="3.5" width="10" height="11" rx="1" />
      <path d="M6 3.5V2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v1" />
      <line x1="5.5" y1="7.5" x2="10.5" y2="7.5" />
      <line x1="5.5" y1="10" x2="9" y2="10" />
    </svg>
  )
  if (type === 'finance') return (
    <svg {...p}>
      <rect x="1.5"  y="9.5" width="3.5" height="5"   rx="0.5" />
      <rect x="6.25" y="6"   width="3.5" height="8.5" rx="0.5" />
      <rect x="11"   y="2.5" width="3.5" height="12"  rx="0.5" />
    </svg>
  )
  return (
    <svg {...p}>
      <line x1="8" y1="14" x2="8" y2="7" />
      <path d="M8 7C8 5 10.5 2.5 13.5 2.5C13.5 6 11 8.5 8 7Z" />
      <path d="M8 9.5C8 7.5 5.5 5.5 2.5 6C2.5 9 5 11 8 9.5Z" />
    </svg>
  )
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      <path d="M10 3L6 8l4 5" />
    </svg>
  )
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      <path d="M6 3l4 5-4 5" />
    </svg>
  )
}

const tooltipCls = [
  'tooltip-slide-right z-[70]',
  'px-2.5 py-1 rounded-md',
  'bg-glomalin-surface border border-glomalin-border shadow-lg',
  'text-xs font-sans text-glomalin-text whitespace-nowrap',
  'pointer-events-none select-none',
].join(' ')

// ─── Component ────────────────────────────────────────────────────────────────

interface SideNavProps {
  user: { email: string; fullName: string | null; role: string }
  grantedModules: string[] | null
}

export default function SideNav({ user, grantedModules }: SideNavProps) {
  const pathname    = usePathname()
  const navRef      = useRef<HTMLElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const openTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [pinned,        setPinned]        = useState<boolean>(readPinnedPref)
  const [peeking,       setPeeking]       = useState(false)
  const [bannerDisabled, setBannerDisabled] = useState<boolean>(readBannerPref)
  const [scene,         setScene]         = useState<SceneType>(readScenePref)
  const [userMenuOpen,  setUserMenuOpen]  = useState(false)

  const isOpen = pinned || peeking

  const displayName = user.fullName || user.email
  const avatarChar  = displayName.charAt(0).toUpperCase()

  // --sidebar-w changes only on pin/unpin. Peek is an overlay — content does not reflow.
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', pinned ? OPEN_W : RAIL_W)
    document.documentElement.style.setProperty('--portal-header-h', '0px')
  }, [pinned])

  useEffect(() => { setUserMenuOpen(false) }, [pathname])

  useEffect(() => {
    if (!userMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [userMenuOpen])

  // ── Peek: hover with 120 ms open / 275 ms close delays ───────────────────

  const handleMouseEnter = useCallback(() => {
    if (pinned) return
    if (closeTimer.current) clearTimeout(closeTimer.current)
    openTimer.current = setTimeout(() => setPeeking(true), 120)
  }, [pinned])

  const handleMouseLeave = useCallback(() => {
    // Hold peek open while user menu is active — prevents sidebar snapping shut mid-interaction.
    if (pinned || userMenuOpen) return
    if (openTimer.current) clearTimeout(openTimer.current)
    closeTimer.current = setTimeout(() => setPeeking(false), 275)
  }, [pinned, userMenuOpen])

  // ── Peek: keyboard focus (no delay — keyboard users need instant feedback) ──

  const handleFocusIn = useCallback(() => {
    if (pinned) return
    if (closeTimer.current) clearTimeout(closeTimer.current)
    if (openTimer.current)  clearTimeout(openTimer.current)
    setPeeking(true)
  }, [pinned])

  const handleFocusOut = useCallback((e: React.FocusEvent) => {
    if (pinned) return
    if (!navRef.current?.contains(e.relatedTarget as Node)) setPeeking(false)
  }, [pinned])

  // ── Actions ───────────────────────────────────────────────────────────────

  const togglePin = useCallback(() => {
    setPinned(prev => {
      const next = !prev
      try { localStorage.setItem(PINNED_KEY, next ? 'true' : 'false') } catch {}
      if (!next) setPeeking(false)
      return next
    })
  }, [])

  const toggleBanner = useCallback(() => {
    setBannerDisabled(prev => {
      const next = !prev
      try { localStorage.setItem(BANNER_KEY, next ? 'true' : 'false') } catch {}
      return next
    })
  }, [])

  const cycleScene = useCallback(() => {
    setScene(current => {
      const next = nextScene(current)
      try { localStorage.setItem(SCENE_KEY, next) } catch {}
      return next
    })
  }, [])

  const visibleIds = new Set(
    MODULES
      .filter(m => grantedModules === null || grantedModules.includes(m.id))
      .map(m => m.id)
  )
  const moduleById = Object.fromEntries(MODULES.map(m => [m.id, m]))

  return (
    <Tooltip.Provider delayDuration={0} skipDelayDuration={0}>
      <nav
        ref={navRef}
        style={{ width: isOpen ? OPEN_W : RAIL_W }}
        className={[
          'fixed left-0 inset-y-0 z-50 flex flex-col',
          'bg-glomalin-surface border-r border-glomalin-border overflow-hidden',
          'transition-[width] duration-[220ms] ease-in-out motion-reduce:transition-none',
        ].join(' ')}
        aria-label="Main navigation"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocusIn}
        onBlur={handleFocusOut}
      >

        {/* ── Brand header ───────────────────────────────────── */}
        <div className="flex items-center h-14 flex-shrink-0 border-b border-glomalin-border">
          <Link
            href="/dashboard"
            aria-label="Glomalin home"
            className="flex items-center justify-center h-full w-16 flex-shrink-0"
          >
            <span className="text-glomalin-accent font-bold tracking-widest font-mono text-xs select-none">◈</span>
          </Link>
          <span className={[
            'text-glomalin-accent font-bold tracking-widest font-mono text-xs select-none whitespace-nowrap',
            'transition-opacity duration-150 ease-out motion-reduce:transition-none',
            isOpen ? 'opacity-100' : 'opacity-0',
          ].join(' ')}>
            GLOMALIN
          </span>
        </div>

        {/* ── Module navigation ──────────────────────────────── */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 scrollbar-none">
          {MODULE_GROUPS.map(group => {
            const groupMods = group.ids
              .filter(id => visibleIds.has(id))
              .map(id => moduleById[id])
              .filter(Boolean)
            if (groupMods.length === 0) return null

            const firstMod = groupMods[0]
            const isGroupActive = group.ids.some(
              id => moduleById[id] && pathname.startsWith(moduleById[id].route)
            )

            return (
              <div key={group.label} className="mt-1">

                {/* Group icon row — links to first module, tooltip shown only when rail is closed */}
                <Tooltip.Root open={isOpen ? false : undefined}>
                  <Tooltip.Trigger asChild>
                    <Link
                      href={firstMod.route}
                      className={[
                        'relative flex items-center h-10 w-full transition-colors duration-100',
                        isGroupActive
                          ? 'text-glomalin-accent bg-glomalin-highlight'
                          : 'text-glomalin-muted hover:text-glomalin-text hover:bg-glomalin-border/40',
                      ].join(' ')}
                    >
                      {isGroupActive && (
                        <span
                          aria-hidden="true"
                          className="absolute left-0 inset-y-1.5 w-[3px] bg-glomalin-accent rounded-r-full"
                        />
                      )}
                      {/* Icon — always in the 64 px column */}
                      <span className="w-16 flex-shrink-0 flex items-center justify-center">
                        <RailIcon type={group.icon} className="w-[18px] h-[18px]" />
                      </span>
                      {/* Label — fades in as width animates open */}
                      <span className={[
                        'text-[11px] font-sans font-medium uppercase tracking-wider whitespace-nowrap select-none',
                        'transition-opacity duration-150 ease-out motion-reduce:transition-none',
                        isOpen ? 'opacity-100' : 'opacity-0',
                      ].join(' ')}>
                        {group.label}
                      </span>
                    </Link>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content side="right" sideOffset={8} className={tooltipCls}>
                      {group.label}
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>

                {/* Individual module links — only mounted when sidebar is open */}
                {isOpen && groupMods.map(mod => (
                  <NavItem
                    key={mod.id}
                    href={mod.route}
                    active={pathname.startsWith(mod.route)}
                  >
                    {mod.label}
                  </NavItem>
                ))}
              </div>
            )
          })}
        </div>

        {/* ── Pin toggle ─────────────────────────────────────── */}
        <div className="flex-shrink-0 border-t border-glomalin-border">
          <Tooltip.Root open={isOpen ? false : undefined}>
            <Tooltip.Trigger asChild>
              <button
                type="button"
                onClick={togglePin}
                aria-label={pinned ? 'Collapse sidebar' : 'Pin sidebar open'}
                aria-pressed={pinned}
                className="flex items-center w-full h-10 text-glomalin-muted hover:text-glomalin-accent transition-colors"
              >
                <span className="w-16 flex-shrink-0 flex items-center justify-center">
                  {pinned
                    ? <ChevronLeftIcon  className="w-4 h-4" />
                    : <ChevronRightIcon className="w-4 h-4" />
                  }
                </span>
                <span className={[
                  'text-xs font-sans whitespace-nowrap',
                  'transition-opacity duration-150 ease-out motion-reduce:transition-none',
                  isOpen ? 'opacity-100' : 'opacity-0',
                ].join(' ')}>
                  {pinned ? 'Collapse' : 'Pin sidebar'}
                </span>
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content side="right" sideOffset={8} className={tooltipCls}>
                {pinned ? 'Collapse' : 'Pin sidebar'}
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </div>

        {/* ── User section ───────────────────────────────────── */}
        <div className="flex-shrink-0 border-t border-glomalin-border">
          <div ref={userMenuRef} className="relative">

            {/* Avatar / name row */}
            <button
              type="button"
              onClick={() => setUserMenuOpen(p => !p)}
              aria-label="User menu"
              aria-expanded={userMenuOpen}
              className={[
                'w-full flex items-center py-3 transition-colors hover:bg-glomalin-border/40',
                isOpen ? 'gap-2.5 px-3' : 'justify-center',
              ].join(' ')}
            >
              <span className="flex-shrink-0 w-7 h-7 rounded bg-glomalin-highlight border border-glomalin-border flex items-center justify-center">
                <span className="text-glomalin-accent font-mono text-xs font-bold">{avatarChar}</span>
              </span>
              {isOpen && (
                <span className="min-w-0 text-left">
                  <span className="block text-glomalin-text font-sans text-sm truncate leading-tight">{displayName}</span>
                  <span className="block text-glomalin-muted font-sans text-[11px] uppercase tracking-wider">{user.role}</span>
                </span>
              )}
            </button>

            {/* User menu — position:fixed so it escapes nav's overflow:hidden */}
            {userMenuOpen && (
              <div
                role="menu"
                onKeyDown={e => { if (e.key === 'Escape') setUserMenuOpen(false) }}
                style={{
                  position: 'fixed',
                  left:   isOpen ? '248px' : '72px',
                  bottom: '8px',
                  zIndex: 60,
                }}
                className="w-56 bg-glomalin-surface border border-glomalin-border rounded-lg shadow-2xl overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-glomalin-border">
                  <p className="text-sm font-sans text-glomalin-text truncate leading-tight">{displayName}</p>
                  <p className="text-[11px] font-mono text-glomalin-muted uppercase tracking-wider mt-0.5">{user.role}</p>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={toggleBanner}
                    className="w-full flex items-center justify-between px-4 py-2 text-xs font-sans text-glomalin-muted hover:text-glomalin-text hover:bg-glomalin-border/40 transition-colors"
                  >
                    <span>ASCII banner</span>
                    <span className={bannerDisabled ? 'text-glomalin-muted' : 'text-glomalin-accent'}>
                      {bannerDisabled ? 'off' : scene}
                    </span>
                  </button>

                  {!bannerDisabled && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={cycleScene}
                      className="w-full flex items-center justify-between px-4 py-2 text-xs font-sans text-glomalin-muted hover:text-glomalin-text hover:bg-glomalin-border/40 transition-colors"
                    >
                      <span>cycle scene</span>
                      <span className="text-glomalin-accent">{scene}</span>
                    </button>
                  )}

                  {user.role === 'admin' && (
                    <Link
                      href="/admin"
                      role="menuitem"
                      className="flex items-center px-4 py-2 text-xs font-sans text-glomalin-muted hover:text-glomalin-text hover:bg-glomalin-border/40 transition-colors"
                    >
                      User management
                    </Link>
                  )}
                </div>

                <form action={logout} className="border-t border-glomalin-border">
                  <button
                    type="submit"
                    role="menuitem"
                    className="w-full text-left px-4 py-2.5 text-xs font-sans text-glomalin-muted hover:text-glomalin-text hover:bg-glomalin-border/40 transition-colors"
                  >
                    Log out
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

      </nav>
    </Tooltip.Provider>
  )
}

// ─── NavItem ──────────────────────────────────────────────────────────────────

function NavItem({
  href, active, children,
}: {
  href: string; active: boolean; children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={[
        'relative flex items-center py-2 pl-[64px] pr-4 text-sm font-sans transition-colors duration-100',
        active
          ? 'text-glomalin-accent bg-glomalin-highlight'
          : 'text-glomalin-muted hover:text-glomalin-text hover:bg-glomalin-border/40',
      ].join(' ')}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute left-0 inset-y-1 w-[3px] bg-glomalin-accent rounded-r-full"
        />
      )}
      {children}
    </Link>
  )
}
