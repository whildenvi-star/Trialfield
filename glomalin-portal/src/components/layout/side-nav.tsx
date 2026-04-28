'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/actions/auth'
import { MODULES } from '@/lib/modules'
import { type SceneType, nextScene } from '@/components/layout/scene-types'

const BANNER_KEY = 'glomalin-banner-disabled'
const SCENE_KEY = 'glomalin-scene'
const VALID_SCENES: SceneType[] = ['mycelium', 'drone', 'seasonal']

const MODULE_GROUPS: { label: string; ids: string[] }[] = [
  { label: 'Field', ids: ['maps', 'field-history', 'field-timeline', 'macro-rollup'] },
  { label: 'Operations', ids: ['field-ops', 'compliance', 'org-cert', 'farm-registry'] },
  { label: 'Finance', ids: ['enterprise-summary', 'marketing', 'grain-tickets', 'farm-budget', 'macro'] },
  { label: 'Inputs', ids: ['seed-inventory', 'meristem-malt'] },
]

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
    const stored = localStorage.getItem(SCENE_KEY)
    if (stored && VALID_SCENES.includes(stored as SceneType)) return stored as SceneType
    return 'mycelium'
  } catch { return 'mycelium' }
}

interface SideNavProps {
  user: { email: string; fullName: string | null; role: string }
  grantedModules: string[] | null
}

export default function SideNav({ user, grantedModules }: SideNavProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [bannerDisabled, setBannerDisabled] = useState<boolean>(readBannerPref)
  const [scene, setScene] = useState<SceneType>(readScenePref)
  const navRef = useRef<HTMLElement>(null)
  const displayName = user.fullName || user.email
  const avatarChar = displayName.charAt(0).toUpperCase()

  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', '220px')
    document.documentElement.style.setProperty('--portal-header-h', '0px')
  }, [])

  useEffect(() => { setMobileOpen(false) }, [pathname])

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
          'fixed left-0 inset-y-0 z-50 w-[220px] flex flex-col',
          'bg-glomalin-surface border-r border-glomalin-border',
          'transition-transform duration-200',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'md:translate-x-0',
        ].join(' ')}
        aria-label="Main navigation"
      >
        {/* Brand */}
        <div className="flex items-center h-14 px-4 flex-shrink-0 border-b border-glomalin-border">
          <span className="text-glomalin-accent font-bold tracking-widest font-mono text-xs select-none">
            ◈ GLOMALIN
          </span>
        </div>

        {/* Scrollable nav */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 scrollbar-none">
          <NavItem href="/dashboard" active={pathname === '/dashboard'}>
            Dashboard
          </NavItem>

          {MODULE_GROUPS.map((group) => {
            const groupMods = group.ids
              .filter((id) => visibleIds.has(id))
              .map((id) => moduleById[id])
              .filter(Boolean)

            if (groupMods.length === 0) return null

            return (
              <div key={group.label} className="mt-1">
                <p className="px-4 pt-3 pb-1 text-[10px] font-mono uppercase tracking-[0.12em] text-glomalin-muted select-none">
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

        {/* User section — pinned bottom */}
        <div className="flex-shrink-0 border-t border-glomalin-border">
          {/* Identity row */}
          <div className="flex items-center gap-2.5 px-3 py-3">
            <div className="flex-shrink-0 w-7 h-7 rounded bg-glomalin-highlight border border-glomalin-border flex items-center justify-center">
              <span className="text-glomalin-accent font-mono text-xs font-bold">
                {avatarChar}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-glomalin-text font-mono text-xs truncate leading-tight">
                {displayName}
              </p>
              <p className="text-glomalin-muted font-mono text-[10px] uppercase tracking-wider leading-tight">
                {user.role}
              </p>
            </div>
          </div>

          {/* ASCII banner toggle */}
          <button
            type="button"
            onClick={toggleBanner}
            className="w-full flex items-center justify-between px-4 py-2 text-xs font-mono text-glomalin-muted hover:text-glomalin-text hover:bg-glomalin-border/40 transition-colors"
          >
            <span>ASCII</span>
            <span className={bannerDisabled ? 'text-glomalin-muted' : 'text-glomalin-accent'}>
              {bannerDisabled ? '[OFF]' : `[${scene.toUpperCase()}]`}
            </span>
          </button>

          {/* Scene cycle — only when banner on */}
          {!bannerDisabled && (
            <button
              type="button"
              onClick={cycleScene}
              className="w-full flex items-center justify-between px-4 py-1.5 text-[10px] font-mono text-glomalin-muted hover:text-glomalin-text hover:bg-glomalin-border/40 transition-colors"
            >
              <span>scene</span>
              <span className="text-glomalin-accent">{scene}</span>
            </button>
          )}

          {user.role === 'admin' && (
            <Link
              href="/admin"
              className="block w-full px-4 py-2 text-xs font-mono text-glomalin-muted hover:text-glomalin-text hover:bg-glomalin-border/40 transition-colors"
            >
              User Management
            </Link>
          )}

          <form action={logout} className="border-t border-glomalin-border">
            <button
              type="submit"
              className="w-full text-left px-4 py-2.5 text-xs font-mono text-glomalin-muted hover:text-glomalin-text hover:bg-glomalin-border/40 transition-colors"
            >
              Log out
            </button>
          </form>
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
        'relative flex items-center px-4 py-2 text-xs font-mono transition-colors duration-100',
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
