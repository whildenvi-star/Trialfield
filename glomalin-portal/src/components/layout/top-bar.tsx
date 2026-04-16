'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/actions/auth'
import { MODULES } from '@/lib/modules'
import ASCIIBannerStrip from '@/components/layout/ASCIIBannerStrip'
import { type SceneType, nextScene } from '@/components/layout/scene-types'

const BANNER_KEY = 'glomalin-banner-disabled'
const SCENE_KEY = 'glomalin-scene'
const VALID_SCENES: SceneType[] = ['mycelium', 'drone', 'seasonal']

function readBannerPref(): boolean {
  if (typeof window === 'undefined') return true // default: disabled
  try {
    const v = localStorage.getItem(BANNER_KEY)
    // If never set, default to disabled (true = disabled)
    return v === null ? true : v === 'true'
  } catch {
    return true
  }
}

function readScenePref(): SceneType {
  if (typeof window === 'undefined') return 'mycelium'
  try {
    const stored = localStorage.getItem(SCENE_KEY)
    if (stored && VALID_SCENES.includes(stored as SceneType)) return stored as SceneType
    return 'mycelium'
  } catch {
    return 'mycelium'
  }
}

interface TopBarProps {
  user: {
    email: string
    fullName: string | null
    role: string
  }
  /** Module IDs the user has been granted access to. null = show all (admin). */
  grantedModules: string[] | null
}

export default function TopBar({ user, grantedModules }: TopBarProps) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [bannerDisabled, setBannerDisabled] = useState<boolean>(readBannerPref)
  const [scene, setScene] = useState<SceneType>(readScenePref)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const displayName = user.fullName || user.email

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  // Update --portal-header-h CSS variable
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)')
    const update = () => {
      const bannerH = bannerDisabled ? 0 : (mql.matches ? 72 : 48)
      document.documentElement.style.setProperty('--portal-header-h', `${56 + bannerH}px`)
    }
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [bannerDisabled])

  const toggleBanner = useCallback(() => {
    setBannerDisabled((prev) => {
      const next = !prev
      try { localStorage.setItem(BANNER_KEY, next ? 'true' : 'false') } catch {}
      return next
    })
  }, [])

  const handleNodeClick = useCallback(() => {
    setScene((current) => {
      const next = nextScene(current)
      try { localStorage.setItem(SCENE_KEY, next) } catch {}
      return next
    })
  }, [])

  return (
    <div className="sticky top-0 z-50">
      {/* ── Single unified bar ── */}
      <header className="w-full bg-glomalin-surface border-b border-glomalin-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-stretch h-14 gap-6">

            {/* Brand */}
            <Link
              href="/dashboard"
              className="flex items-center flex-shrink-0 text-glomalin-accent font-bold tracking-widest font-mono text-xs hover:opacity-75 transition-opacity"
            >
              ◈ GLOMALIN
            </Link>

            {/* Nav tabs — scrollable on mobile */}
            <nav
              className="flex items-stretch gap-0.5 overflow-x-auto flex-1 min-w-0 scrollbar-none"
              aria-label="Main navigation"
            >
              {/* Dashboard */}
              <NavTab href="/dashboard" active={pathname === '/dashboard'}>
                Dashboard
              </NavTab>

              {/* Module tabs — filtered to granted modules only */}
              {MODULES.filter((mod) => grantedModules === null || grantedModules.includes(mod.id)).map((mod) => (
                <NavTab
                  key={mod.id}
                  href={mod.route}
                  active={pathname.startsWith(mod.route)}
                >
                  {mod.label}
                </NavTab>
              ))}
            </nav>

            {/* User menu */}
            <div className="relative flex-shrink-0 flex items-center" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((p) => !p)}
                className="flex items-center gap-1.5 text-glomalin-text text-xs font-mono hover:text-glomalin-accent transition-colors"
              >
                <span className="max-w-[120px] truncate">{displayName}</span>
                <svg
                  className={`w-3 h-3 text-glomalin-muted transition-transform duration-150 ${menuOpen ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-glomalin-surface border border-glomalin-border rounded shadow-lg z-50">
                  <div className="px-4 py-3 border-b border-glomalin-border">
                    <p className="text-glomalin-muted text-xs truncate">{user.email}</p>
                    <p className="text-glomalin-muted text-xs mt-0.5 uppercase tracking-wider">{user.role}</p>
                  </div>

                  {user.role === 'admin' && (
                    <>
                      <Link
                        href="/admin"
                        onClick={() => setMenuOpen(false)}
                        className="block w-full text-left px-4 py-2.5 text-xs text-glomalin-text font-mono hover:bg-glomalin-border transition-colors"
                      >
                        User Management
                      </Link>
                      <div className="border-t border-glomalin-border" />
                    </>
                  )}

                  <button
                    type="button"
                    onClick={toggleBanner}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-glomalin-text font-mono hover:bg-glomalin-border transition-colors"
                  >
                    <span>ASCII Banner</span>
                    <span className={bannerDisabled ? 'text-glomalin-muted' : 'text-glomalin-accent'}>
                      {bannerDisabled ? '[OFF]' : '[ON]'}
                    </span>
                  </button>

                  <div className="border-t border-glomalin-border" />
                  <form action={logout}>
                    <button
                      type="submit"
                      className="w-full text-left px-4 py-2.5 text-xs text-glomalin-text font-mono hover:bg-glomalin-border transition-colors"
                    >
                      Log out
                    </button>
                  </form>
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* Optional ASCII banner — opt-in, below the bar */}
      {!bannerDisabled && (
        <>
          <div className="hidden md:block">
            <ASCIIBannerStrip height={72} scene={scene} onNodeClick={handleNodeClick} />
          </div>
          <div className="block md:hidden">
            <ASCIIBannerStrip height={48} nodeCount={6} scene={scene} onNodeClick={handleNodeClick} />
          </div>
        </>
      )}
    </div>
  )
}

function NavTab({
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
      className={`
        relative flex items-center px-3 text-xs font-mono whitespace-nowrap transition-colors
        ${active
          ? 'text-glomalin-accent'
          : 'text-glomalin-muted hover:text-glomalin-text'
        }
      `}
    >
      {children}
      {/* Active underline */}
      {active && (
        <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-glomalin-accent rounded-full" />
      )}
    </Link>
  )
}
