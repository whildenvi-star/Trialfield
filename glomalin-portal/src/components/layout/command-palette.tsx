'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { MODULES } from '@/lib/modules'

interface CommandPaletteProps {
  grantedModules: string[] | null
}

export function CommandPalette({ grantedModules }: CommandPaletteProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const visibleModules = MODULES.filter(
    (m) => grantedModules === null || grantedModules.includes(m.id)
  )

  const results = query.trim() === ''
    ? visibleModules
    : visibleModules.filter((m) => {
        const q = query.toLowerCase()
        return m.label.toLowerCase().includes(q) || m.sublabel.toLowerCase().includes(q)
      })

  const openPalette = useCallback(() => {
    setQuery('')
    setActiveIndex(0)
    setOpen(true)
  }, [])

  const closePalette = useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [])

  const navigate = useCallback((route: string) => {
    closePalette()
    router.push(route)
  }, [closePalette, router])

  // Close on route change
  useEffect(() => { closePalette() }, [pathname, closePalette])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  // Scroll active item into view
  useEffect(() => {
    const item = listRef.current?.children[activeIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  // Reset active index when results change
  useEffect(() => { setActiveIndex(0) }, [query])

  // Global keyboard listener
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (open) { closePalette() } else { openPalette() }
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [open, openPalette, closePalette])

  function handleInputKeydown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[activeIndex]) navigate(results[activeIndex].route)
    } else if (e.key === 'Escape') {
      closePalette()
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
        onClick={closePalette}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-label="Command palette"
        aria-modal="true"
        className="fixed top-[18vh] left-1/2 -translate-x-1/2 z-[61] w-full max-w-lg mx-4"
      >
        <div className="bg-glomalin-surface border border-glomalin-border rounded-lg shadow-2xl overflow-hidden">

          {/* Search input */}
          <div className="flex items-center gap-3 px-4 border-b border-glomalin-border">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4 text-glomalin-muted flex-shrink-0"
              aria-hidden="true"
            >
              <circle cx="6.5" cy="6.5" r="4.5" />
              <line x1="10" y1="10" x2="14" y2="14" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleInputKeydown}
              placeholder="Search modules..."
              className="flex-1 py-3.5 text-sm font-mono bg-transparent text-glomalin-text placeholder-glomalin-muted outline-none"
              autoComplete="off"
              spellCheck="false"
            />
            <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] font-mono text-glomalin-muted border border-glomalin-border rounded px-1.5 py-0.5 flex-shrink-0">
              esc
            </kbd>
          </div>

          {/* Results */}
          <div
            ref={listRef}
            className="overflow-y-auto max-h-[320px] py-1"
          >
            {results.length === 0 ? (
              <p className="px-4 py-6 text-sm font-mono text-glomalin-muted text-center">
                No modules match &ldquo;{query}&rdquo;
              </p>
            ) : (
              results.map((mod, i) => {
                const isActive = i === activeIndex
                const isCurrent = pathname.startsWith(mod.route)
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => navigate(mod.route)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={[
                      'relative w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                      isActive ? 'bg-glomalin-highlight' : 'hover:bg-glomalin-border/30',
                    ].join(' ')}
                  >
                    {/* Active row indicator */}
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 inset-y-2 w-[3px] bg-glomalin-accent rounded-r-full"
                      />
                    )}

                    <div className="min-w-0 flex-1">
                      <p className={[
                        'text-sm font-sans truncate',
                        isCurrent ? 'text-glomalin-accent' : isActive ? 'text-glomalin-text' : 'text-glomalin-text',
                      ].join(' ')}>
                        {mod.label}
                      </p>
                      <p className="text-[11px] font-mono text-glomalin-muted truncate mt-0.5">
                        {mod.sublabel}
                      </p>
                    </div>

                    {isCurrent && (
                      <span className="flex-shrink-0 text-[10px] font-mono text-glomalin-accent border border-glomalin-accent/30 rounded px-1.5 py-0.5">
                        current
                      </span>
                    )}
                  </button>
                )
              })
            )}
          </div>

          {/* Footer hint */}
          <div className="flex items-center gap-4 px-4 py-2.5 border-t border-glomalin-border">
            <span className="flex items-center gap-1 text-[10px] font-mono text-glomalin-muted">
              <kbd className="border border-glomalin-border rounded px-1 py-0.5">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1 text-[10px] font-mono text-glomalin-muted">
              <kbd className="border border-glomalin-border rounded px-1 py-0.5">↵</kbd>
              open
            </span>
            <span className="flex items-center gap-1 text-[10px] font-mono text-glomalin-muted">
              <kbd className="border border-glomalin-border rounded px-1 py-0.5">⌘K</kbd>
              toggle
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
