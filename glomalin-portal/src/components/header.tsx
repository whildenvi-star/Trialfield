'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { logout } from '@/app/actions/auth'

interface HeaderUser {
  email: string
  fullName: string | null
  role: string
}

interface HeaderProps {
  user: HeaderUser
  bannerDisabled?: boolean
  onBannerToggle?: () => void
}

export default function Header({ user, bannerDisabled, onBannerToggle }: HeaderProps) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const displayName = user.fullName || user.email

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  return (
    <header className="w-full bg-glomalin-surface border-b border-glomalin-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Left: Branding */}
          <Link
            href="/dashboard"
            className="text-glomalin-accent font-bold tracking-wider font-mono text-sm hover:opacity-80 transition-opacity"
          >
            GLOMALIN
          </Link>

          {/* Right: User menu */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setOpen((prev) => !prev)}
              className="flex items-center gap-1.5 text-glomalin-text text-sm font-mono hover:text-glomalin-accent transition-colors"
            >
              <span>{displayName}</span>
              <svg
                className={`w-3.5 h-3.5 text-glomalin-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-56 bg-glomalin-surface border border-glomalin-border rounded shadow-lg z-50">
                <div className="px-4 py-3">
                  <p className="text-glomalin-muted text-xs truncate">{user.email}</p>
                  <p className="text-glomalin-muted text-xs mt-1">
                    <span className="uppercase tracking-wider">{user.role}</span>
                  </p>
                </div>
                <div className="border-t border-glomalin-border" />
                {onBannerToggle && (
                  <>
                    <button
                      type="button"
                      onClick={onBannerToggle}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-glomalin-text font-mono hover:bg-glomalin-border transition-colors"
                    >
                      <span>Banner</span>
                      <span className={bannerDisabled ? 'text-glomalin-muted' : 'text-glomalin-accent'}>
                        {bannerDisabled ? '[OFF]' : '[ON]'}
                      </span>
                    </button>
                    <div className="border-t border-glomalin-border" />
                  </>
                )}
                <form action={logout}>
                  <button
                    type="submit"
                    className="w-full text-left px-4 py-2.5 text-sm text-glomalin-text font-mono hover:bg-glomalin-border transition-colors"
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
  )
}
