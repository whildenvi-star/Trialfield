'use client'

import { useState, useEffect, useRef, useCallback, useId } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/actions/auth'
import { MODULES } from '@/lib/modules'
import { type SceneType, nextScene } from '@/components/layout/scene-types'

const BANNER_KEY = 'glomalin-banner-disabled'
const SCENE_KEY = 'glomalin-scene'
const SIDEBAR_COLLAPSED_KEY = 'glomalin-sidebar-collapsed'
const VALID_SCENES: SceneType[] = ['mycelium', 'drone', 'seasonal']

const MODULE_GROUPS: {
  label: string
  icon: 'field' | 'ops' | 'finance' | 'inputs'
  ids: string[]
}[] = [
  { label: 'Field',      icon: 'field',   ids: ['maps', 'weather', 'field-history', 'field-timeline'] },
  { label: 'Operations', icon: 'ops',     ids: ['field-ops', 'compliance', 'org-cert', 'farm-registry'] },
  { label: 'Finance',    icon: 'finance', ids: ['performance', 'enterprise-summary', 'farm-budget', 'grain-tickets'] },
  { label: 'Inputs',     icon: 'inputs',  ids: ['seed-inventory', 'meristem-malt'] },
]

function readBannerPref(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const v = localStorage.getItem(BANNER_KEY)
    return v === null ? true : v === 'true'
  } catch { return true }
}

function readCollapsedPref(): boolean {
  if (typeof window === 'undefined') return false
  try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true' } catch { return false }
}

function readScenePref(): SceneType {
  if (typeof window === 'undefined') return 'mycelium'
  try {
    const stored = localStorage.getItem(SCENE_KEY)
    if (stored && VALID_SCENES.includes(stored as SceneType)) return stored as SceneType
    return 'mycelium'
  } catch { return 'mycelium' }
}

// Rail icons — 16×16, stroke-based, no fill
function RailIcon({ type, className }: { type: 'field' | 'ops' | 'finance' | 'inputs'; className?: string }) {
  const props = {
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
  if (type === 'field') {
    // Map grid: square with crosshairs
    return (
      <svg {...props}>
        <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" />
        <line x1="8" y1="1.5" x2="8" y2="14.5" />
        <line x1="1.5" y1="8" x2="14.5" y2="8" />
      </svg>
    )
  }
  if (type === 'ops') {
    // Clipboard: rect with top clip + task lines
    return (
      <svg {...props}>
        <rect x="3" y="3.5" width="10" height="11" rx="1" />
        <path d="M6 3.5V2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v1" />
        <line x1="5.5" y1="7.5" x2="10.5" y2="7.5" />
        <line x1="5.5" y1="10" x2="9" y2="10" />
      </svg>
    )
  }
  if (type === 'finance') {
    // Bar chart: 3 ascending bars
    return (
      <svg {...props}>
        <rect x="1.5" y="9.5" width="3.5" height="5" rx="0.5" />
        <rect x="6.25" y="6" width="3.5" height="8.5" rx="0.5" />
        <rect x="11" y="2.5" width="3.5" height="12" rx="0.5" />
      </svg>
    )
  }
  // inputs — seedling: stem + two leaves
  return (
    <svg {...props}>
      <line x1="8" y1="14" x2="8" y2="7" />
      <path d="M8 7C8 5 10.5 2.5 13.5 2.5C13.5 6 11 8.5 8 7Z" />
      <path d="M8 9.5C8 7.5 5.5 5.5 2.5 6C2.5 9 5 11 8 9.5Z" />
    </svg>
  )
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M10 3L6 8l4 5" />
    </svg>
  )
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M6 3l4 5-4 5" />
    </svg>
  )
}

interface SideNavProps {
  user: { email: string; fullName: string | null; role: string }
  grantedModules: string[] | null
}

export default function SideNav({ user, grantedModules }: SideNavProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsedPref)
  const [bannerDisabled, setBannerDisabled] = useState<boolean>(readBannerPref)
  const [scene, setScene] = useState<SceneType>(readScenePref)
  const navRef = useRef<HTMLElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const menuId = useId()
  const displayName = user.fullName || user.email
  const avatarChar = displayName.charAt(0).toUpperCase()

  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', collapsed ? '48px' : '220px')
    document.documentElement.style.setProperty('--portal-header-h', '0px')
  }, [collapsed])

  useEffect(() => { setMobileOpen(false) }, [pathname])
  useEffect(() => { if (!collapsed) setUserMenuOpen(false) }, [collapsed])
  useEffect(() => { setUserMenuOpen(false) }, [pathname])

  useEffect(() => {
    if (!mobileOpen) return
    function handleClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setMobileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [mobileOpen])

  useEffect(() => {
    if (!userMenuOpen) return
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [userMenuOpen])

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? 'true' : 'false') } catch {}
      return next
    })
  }, [])

  const toggleBanner = useCallback(() => {
    setBannerDisabled((prev) => {
      const next = !prev
      try { localStorage.setItem(BANNER_KEY, next ? 'true' : 'false') } catch {}
      return next
    })
  }, [])

  const cycleScene = useCallback(() => {
    setScene((current) => {
      const next = nextScene(current)
      try { localStorage.setItem(SCENE_KEY, next) } catch {}
      return next
    })
  }, [])

  const visibleIds = new Set(
    MODULES
      .filter((m) => grantedModules === null || grantedModules.includes(m.id))
      .map((m) => m.id)
  )
  const moduleById = Object.fromEntries(MODULES.map((m) => [m.id, m]))

  return (
    <>
      {/* Sidebar */}
      <nav
        ref={navRef}
        className={[
          'fixed left-0 inset-y-0 z-50 flex flex-col',
          'bg-glomalin-surface border-r border-glomalin-border',
          'transition-[transform,width] duration-300',
          // Mobile: always 220px wide, translate-based overlay
          'w-[220px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: always visible, width transitions between 220px and 48px
          'md:translate-x-0',
          collapsed ? 'md:w-12' : 'md:w-[220px]',
        ].join(' ')}
        aria-label="Main navigation"
      >

        {/* ── Brand header ───────────────────────────────────── */}
        <div className="flex items-center h-14 flex-shrink-0 border-b border-glomalin-border overflow-hidden">
          {/* ◈ GLOMALIN — always a home link */}
          <Link
            href="/dashboard"
            onClick={() => setMobileOpen(false)}
            className={[
              'flex items-center h-full flex-1 min-w-0 gap-1.5 px-4',
              collapsed ? 'md:justify-center md:px-0' : '',
            ].join(' ')}
          >
            <span className="text-glomalin-accent font-bold tracking-widest font-mono text-xs select-none flex-shrink-0">
              ◈
            </span>
            <span className={[
              'text-glomalin-accent font-bold tracking-widest font-mono text-xs select-none whitespace-nowrap',
              collapsed ? 'md:hidden' : '',
            ].join(' ')}>
              GLOMALIN
            </span>
          </Link>

          {/* Collapse button — desktop only, only when expanded */}
          {!collapsed && (
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Collapse sidebar"
              className="hidden md:flex flex-shrink-0 items-center justify-center w-8 h-8 mr-2 rounded text-glomalin-muted hover:text-glomalin-accent transition-colors"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ── Full module list — mobile always, desktop expanded ── */}
        <div className={[
          'flex-1 overflow-y-auto overflow-x-hidden py-2 scrollbar-none',
          collapsed ? 'md:hidden' : '',
        ].join(' ')}>
          {MODULE_GROUPS.map((group) => {
            const groupMods = group.ids
              .filter((id) => visibleIds.has(id))
              .map((id) => moduleById[id])
              .filter(Boolean)

            if (groupMods.length === 0) return null

            return (
              <div key={group.label} className="mt-1">
                <p className="px-4 pt-3 pb-1 text-[11px] font-sans font-medium uppercase tracking-wider text-glomalin-muted select-none">
                  {group.label}
                </p>
                {groupMods.map((mod) => (
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

        {/* ── Icon rail — desktop only, collapsed ──────────── */}
        {collapsed && (
          <div className="hidden md:flex flex-col flex-1 items-center py-3 gap-1 overflow-hidden">
            {MODULE_GROUPS.map((group) => {
              const firstMod = group.ids
                .filter((id) => visibleIds.has(id))
                .map((id) => moduleById[id])
                .find(Boolean)
              if (!firstMod) return null

              const isGroupActive = group.ids.some(
                (id) => moduleById[id] && pathname.startsWith(moduleById[id].route)
              )

              return (
                <Link
                  key={group.label}
                  href={firstMod.route}
                  title={group.label}
                  className={[
                    'w-9 h-9 flex items-center justify-center rounded-md transition-colors',
                    isGroupActive
                      ? 'text-glomalin-accent bg-glomalin-highlight'
                      : 'text-glomalin-muted hover:text-glomalin-text hover:bg-glomalin-border/40',
                  ].join(' ')}
                >
                  <RailIcon type={group.icon} className="w-4 h-4" />
                </Link>
              )
            })}
          </div>
        )}

        {/* ── User section — pinned bottom ─────────────────── */}
        <div className="flex-shrink-0 border-t border-glomalin-border">

          {/* Condensed avatar — desktop collapsed only */}
          {collapsed && (
            <div ref={userMenuRef} className="hidden md:flex justify-center py-3 relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((p) => !p)}
                aria-label="User menu"
                aria-expanded={userMenuOpen}
                aria-controls={menuId}
                className="w-7 h-7 rounded bg-glomalin-highlight border border-glomalin-border flex items-center justify-center hover:border-glomalin-accent/60 transition-colors"
              >
                <span className="text-glomalin-accent font-mono text-xs font-bold">{avatarChar}</span>
              </button>

              {/* User menu popover */}
              {userMenuOpen && (
                <div
                  id={menuId}
                  role="menu"
                  className="fixed left-12 bottom-0 mb-2 w-56 bg-glomalin-surface border border-glomalin-border rounded-lg shadow-2xl z-[55] overflow-hidden"
                >
                  {/* Identity header */}
                  <div className="px-4 py-3 border-b border-glomalin-border">
                    <p className="text-sm font-sans text-glomalin-text truncate leading-tight">{displayName}</p>
                    <p className="text-[11px] font-mono text-glomalin-muted uppercase tracking-wider mt-0.5">{user.role}</p>
                  </div>

                  {/* Options */}
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

                  {/* Log out */}
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
          )}

          {/* Full user section — mobile always, desktop expanded */}
          <div className={collapsed ? 'md:hidden' : ''}>
            <div className="flex items-center gap-2.5 px-3 py-3">
              <div className="flex-shrink-0 w-7 h-7 rounded bg-glomalin-highlight border border-glomalin-border flex items-center justify-center">
                <span className="text-glomalin-accent font-mono text-xs font-bold">{avatarChar}</span>
              </div>
              <div className="min-w-0">
                <p className="text-glomalin-text font-sans text-sm truncate leading-tight">{displayName}</p>
                <p className="text-glomalin-muted font-sans text-[11px] uppercase tracking-wider leading-tight">{user.role}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleBanner}
              className="w-full flex items-center justify-between px-4 py-2 text-xs font-sans text-glomalin-muted hover:text-glomalin-text hover:bg-glomalin-border/40 transition-colors"
            >
              <span>ASCII</span>
              <span className={bannerDisabled ? 'text-glomalin-muted' : 'text-glomalin-accent'}>
                {bannerDisabled ? '[OFF]' : `[${scene.toUpperCase()}]`}
              </span>
            </button>

            {!bannerDisabled && (
              <button
                type="button"
                onClick={cycleScene}
                className="w-full flex items-center justify-between px-4 py-1.5 text-[10px] font-sans text-glomalin-muted hover:text-glomalin-text hover:bg-glomalin-border/40 transition-colors"
              >
                <span>scene</span>
                <span className="text-glomalin-accent">{scene}</span>
              </button>
            )}

            {user.role === 'admin' && (
              <Link
                href="/admin"
                className="block w-full px-4 py-2 text-xs font-sans text-glomalin-muted hover:text-glomalin-text hover:bg-glomalin-border/40 transition-colors"
              >
                User Management
              </Link>
            )}

            <form action={logout} className="border-t border-glomalin-border">
              <button
                type="submit"
                className="w-full text-left px-4 py-2.5 text-xs font-sans text-glomalin-muted hover:text-glomalin-text hover:bg-glomalin-border/40 transition-colors"
              >
                Log out
              </button>
            </form>
          </div>

          {/* Expand button — desktop collapsed only */}
          {collapsed && (
            <div className="hidden md:block border-t border-glomalin-border">
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label="Expand sidebar"
                className="w-full flex items-center justify-center py-3 text-glomalin-muted hover:text-glomalin-accent transition-colors"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile hamburger */}
      <button
        type="button"
        aria-label="Open navigation"
        onClick={() => setMobileOpen((p) => !p)}
        className="fixed top-3.5 left-3.5 z-50 md:hidden flex flex-col gap-[5px] p-1.5"
      >
        <span className="block w-5 h-[2px] bg-glomalin-muted rounded-full" />
        <span className="block w-5 h-[2px] bg-glomalin-muted rounded-full" />
        <span className="block w-5 h-[2px] bg-glomalin-muted rounded-full" />
      </button>
    </>
  )
}

function NavItem({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={[
        'relative flex items-center px-4 py-2 text-sm font-sans transition-colors duration-100',
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
