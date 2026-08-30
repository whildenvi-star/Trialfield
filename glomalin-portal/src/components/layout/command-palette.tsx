'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { MODULES, PAGES, type Module, type PortalPage } from '@/lib/modules'
import {
  PALETTE_OPEN_EVENT,
  type PaletteOpenDetail,
  type RecentEntry,
  readRecents,
  pushRecent,
} from '@/lib/palette-bus'

/**
 * The palette is the router: one input that reaches every module, page, and —
 * now — the objects the farm actually runs on. Object names are the user's own
 * vocabulary ("north 80"), so typing one is recognition, not recall; that is why
 * jumper-style palettes out-adopt command-runner palettes.
 *
 * Rules this file keeps:
 *   - it opens seeded (recents + this screen's actions), never as an empty box
 *   - every row teaches its own shortcut where one exists
 *   - nothing here is palette-exclusive; all of it has a URL and a visible path
 */

// ─── Chords ───────────────────────────────────────────────────────────────────
// The graduation path: the palette shows these, then you stop needing the palette.

const CHORDS: Record<string, string> = {
  'maps': 'g m',
  'farm-budget': 'g b',
  'grain-tickets': 'g t',
  'field-history': 'g h',
  'weather': 'g w',
}
const CHORD_ROUTES: Record<string, string> = {
  m: '/app/maps',
  b: '/app/farm-budget',
  t: '/app/grain-tickets',
  h: '/app/field-history',
  w: '/app/weather',
  d: '/dashboard',
}

// ─── Matching ─────────────────────────────────────────────────────────────────

/**
 * Subsequence match with contiguity and word-start bonuses. Returns null for a
 * miss so callers can filter, or a score where higher is better.
 */
function fuzzyScore(haystack: string, needle: string): number | null {
  const h = haystack.toLowerCase()
  const n = needle.toLowerCase()
  if (!n) return 0
  if (h === n) return 1000
  if (h.startsWith(n)) return 800
  const wordStart = h.includes(' ' + n) || h.includes('-' + n)
  if (h.includes(n)) return wordStart ? 600 : 400

  // Fall back to scattered-subsequence so "gtk" finds "Grain Tickets".
  let score = 0
  let hi = 0
  let streak = 0
  for (const ch of n) {
    let found = -1
    for (let i = hi; i < h.length; i++) {
      if (h[i] === ch) { found = i; break }
    }
    if (found === -1) return null
    const atWordStart = found === 0 || h[found - 1] === ' ' || h[found - 1] === '-'
    streak = found === hi ? streak + 1 : 0
    score += 10 + streak * 5 + (atWordStart ? 15 : 0)
    hi = found + 1
  }
  return score
}

/** Best score across a destination's label, sublabel, and aliases. */
function scoreTerms(query: string, terms: (string | undefined)[]): number | null {
  let best: number | null = null
  for (const t of terms) {
    if (!t) continue
    const s = fuzzyScore(t, query)
    if (s != null && (best == null || s > best)) best = s
  }
  return best
}

// ─── Rows ─────────────────────────────────────────────────────────────────────

interface ObjectHit {
  kind: 'field' | 'contract'
  id: string
  label: string
  sublabel: string
  route: string
}

interface Command {
  id: string
  label: string
  sublabel: string
  run: () => void
}

type Row =
  | { type: 'recent'; key: string; label: string; sublabel: string; route: string; kind: RecentEntry['kind'] }
  | { type: 'object'; key: string; hit: ObjectHit }
  | { type: 'module'; key: string; mod: Module }
  | { type: 'page'; key: string; page: PortalPage }
  | { type: 'command'; key: string; cmd: Command }

interface Section {
  label: string
  rows: Row[]
}

interface CommandPaletteProps {
  grantedModules: string[] | null
}

export function CommandPalette({ grantedModules }: CommandPaletteProps) {
  const router = useRouter()
  const pathname = usePathname()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [recents, setRecents] = useState<RecentEntry[]>([])
  const [hits, setHits] = useState<ObjectHit[]>([])
  const [searching, setSearching] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const granted = useCallback(
    (id: string) => grantedModules === null || grantedModules.includes(id),
    [grantedModules]
  )

  const visibleModules = useMemo(() => MODULES.filter((m) => granted(m.id)), [granted])
  const visiblePages = useMemo(
    () => PAGES.filter((p) => !p.requires || granted(p.requires)),
    [granted]
  )

  // ── Open / close ───────────────────────────────────────────────────────────

  const openPalette = useCallback((seed = '') => {
    setQuery(seed)
    setActiveIndex(0)
    setHits([])
    setRecents(readRecents())
    setOpen(true)
  }, [])

  const closePalette = useCallback(() => {
    setOpen(false)
    setQuery('')
    setHits([])
  }, [])

  const go = useCallback(
    (row: { label: string; sublabel: string; route: string; key: string; kind: RecentEntry['kind'] }) => {
      pushRecent({ key: row.key, label: row.label, sublabel: row.sublabel, route: row.route, kind: row.kind })
      closePalette()
      router.push(row.route)
    },
    [closePalette, router]
  )

  useEffect(() => { closePalette() }, [pathname, closePalette])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10)
  }, [open])

  useEffect(() => { setActiveIndex(0) }, [query])

  // ── Global keys: Cmd+K, the open event, and go-to chords ────────────────────

  useEffect(() => {
    function isTyping(el: EventTarget | null): boolean {
      const node = el as HTMLElement | null
      if (!node) return false
      const tag = node.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable
    }

    let chordArmed = false
    let chordTimer: ReturnType<typeof setTimeout> | null = null

    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (open) closePalette()
        else openPalette()
        return
      }

      if (open || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return

      if (chordArmed) {
        const route = CHORD_ROUTES[e.key.toLowerCase()]
        chordArmed = false
        if (chordTimer) clearTimeout(chordTimer)
        if (route) {
          e.preventDefault()
          router.push(route)
        }
        return
      }

      if (e.key === 'g') {
        chordArmed = true
        chordTimer = setTimeout(() => { chordArmed = false }, 1200)
      }
    }

    function handleOpenEvent(e: Event) {
      const detail = (e as CustomEvent<PaletteOpenDetail>).detail
      openPalette(detail?.query ?? '')
    }

    window.addEventListener('keydown', handleKeydown)
    window.addEventListener(PALETTE_OPEN_EVENT, handleOpenEvent)
    return () => {
      window.removeEventListener('keydown', handleKeydown)
      window.removeEventListener(PALETTE_OPEN_EVENT, handleOpenEvent)
      if (chordTimer) clearTimeout(chordTimer)
    }
  }, [open, openPalette, closePalette, router])

  // ── Object search (debounced, abortable) ───────────────────────────────────

  useEffect(() => {
    const q = query.trim()
    if (!open || q.length < 2 || q.startsWith('>')) {
      setHits([])
      setSearching(false)
      return
    }

    const controller = new AbortController()
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/objects?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(String(res.status))
        const data = (await res.json()) as { results?: ObjectHit[] }
        setHits(data.results ?? [])
      } catch {
        // Offline or a service is down — modules still match locally, which is
        // the whole point of not making this the only path.
        setHits([])
      } finally {
        setSearching(false)
      }
    }, 180)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [query, open])

  // ── Commands ───────────────────────────────────────────────────────────────

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [
      {
        id: 'reload',
        label: 'Reload data',
        sublabel: 'Refetch this page from the server',
        run: () => { closePalette(); router.refresh() },
      },
      {
        id: 'copy-link',
        label: 'Copy link to this page',
        sublabel: 'Put the current URL on the clipboard',
        run: () => {
          try { void navigator.clipboard?.writeText(window.location.href) } catch {}
          closePalette()
        },
      },
    ]
    if (granted('maps')) {
      list.push({
        id: 'log-pass',
        label: 'Log a field pass',
        sublabel: 'Open the in-field tap-confirm logger',
        run: () => { closePalette(); router.push('/crop-plans') },
      })
    }
    return list
  }, [closePalette, router, granted])

  // ── Sections ───────────────────────────────────────────────────────────────

  const sections = useMemo<Section[]>(() => {
    const raw = query.trim()
    const commandMode = raw.startsWith('>')
    const q = commandMode ? raw.slice(1).trim() : raw
    const out: Section[] = []

    // Empty query: seed with recents and everything reachable. Never an empty box.
    if (!raw) {
      if (recents.length) {
        out.push({
          label: 'Recent',
          rows: recents.map((r) => ({
            type: 'recent' as const,
            key: `recent:${r.key}`,
            label: r.label,
            sublabel: r.sublabel,
            route: r.route,
            kind: r.kind,
          })),
        })
      }
      out.push({
        label: 'Modules',
        rows: visibleModules.map((m) => ({ type: 'module' as const, key: `module:${m.id}`, mod: m })),
      })
      out.push({
        label: 'Pages',
        rows: visiblePages.map((p) => ({ type: 'page' as const, key: `page:${p.id}`, page: p })),
      })
      return out.filter((s) => s.rows.length)
    }

    if (!commandMode) {
      if (hits.length) {
        out.push({
          label: 'Jump to',
          rows: hits.map((h) => ({ type: 'object' as const, key: `object:${h.kind}:${h.id}`, hit: h })),
        })
      }

      const mods = visibleModules
        .map((m) => ({ m, s: scoreTerms(q, [m.label, m.sublabel, ...(m.aliases ?? [])]) }))
        .filter((x): x is { m: Module; s: number } => x.s != null)
        .sort((a, b) => b.s - a.s)
      if (mods.length) {
        out.push({
          label: 'Modules',
          rows: mods.map(({ m }) => ({ type: 'module' as const, key: `module:${m.id}`, mod: m })),
        })
      }

      const pages = visiblePages
        .map((p) => ({ p, s: scoreTerms(q, [p.label, p.sublabel, ...(p.aliases ?? [])]) }))
        .filter((x): x is { p: PortalPage; s: number } => x.s != null)
        .sort((a, b) => b.s - a.s)
      if (pages.length) {
        out.push({
          label: 'Pages',
          rows: pages.map(({ p }) => ({ type: 'page' as const, key: `page:${p.id}`, page: p })),
        })
      }
    }

    const cmds = commands
      .map((c) => ({ c, s: scoreTerms(q, [c.label, c.sublabel]) }))
      .filter((x): x is { c: Command; s: number } => x.s != null)
      .sort((a, b) => b.s - a.s)
    if (cmds.length) {
      out.push({
        label: 'Commands',
        rows: cmds.map(({ c }) => ({ type: 'command' as const, key: `cmd:${c.id}`, cmd: c })),
      })
    }

    return out.filter((s) => s.rows.length)
  }, [query, recents, hits, visibleModules, visiblePages, commands])

  const flatRows = useMemo(() => sections.flatMap((s) => s.rows), [sections])

  useEffect(() => {
    if (activeIndex > flatRows.length - 1) setActiveIndex(Math.max(0, flatRows.length - 1))
  }, [flatRows.length, activeIndex])

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-row-index="${activeIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, flatRows.length])

  const runRow = useCallback(
    (row: Row) => {
      switch (row.type) {
        case 'recent':
          go({ key: row.key.replace(/^recent:/, ''), label: row.label, sublabel: row.sublabel, route: row.route, kind: row.kind })
          break
        case 'object':
          go({ key: `${row.hit.kind}:${row.hit.id}`, label: row.hit.label, sublabel: row.hit.sublabel, route: row.hit.route, kind: 'field' })
          break
        case 'module':
          go({ key: `module:${row.mod.id}`, label: row.mod.label, sublabel: row.mod.sublabel, route: row.mod.route, kind: 'module' })
          break
        case 'page':
          go({ key: `page:${row.page.id}`, label: row.page.label, sublabel: row.page.sublabel, route: row.page.route, kind: 'page' })
          break
        case 'command':
          row.cmd.run()
          break
      }
    },
    [go]
  )

  function handleInputKeydown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, flatRows.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const row = flatRows[activeIndex]
      if (row) runRow(row)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closePalette()
    }
  }

  if (!open) return null

  let rowIndex = -1

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
        onClick={closePalette}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-label="Command palette"
        aria-modal="true"
        className="fixed top-[12vh] left-1/2 -translate-x-1/2 z-[61] w-full max-w-xl px-4"
      >
        <div className="bg-glomalin-surface border border-glomalin-border rounded-lg shadow-2xl overflow-hidden">

          {/* Input */}
          <div className="flex items-center gap-3 px-4 border-b border-glomalin-border">
            <svg
              xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none"
              stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
              className="w-4 h-4 text-glomalin-muted flex-shrink-0" aria-hidden="true"
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
              placeholder="Search fields, contracts, modules…"
              className="flex-1 py-3.5 text-sm font-mono bg-transparent text-glomalin-text placeholder-glomalin-muted outline-none"
              autoComplete="off"
              spellCheck="false"
              aria-label="Search fields, contracts and modules"
            />
            {searching && (
              <span className="text-[10px] font-mono text-glomalin-muted flex-shrink-0" aria-live="polite">
                searching…
              </span>
            )}
            <kbd className="hidden sm:flex items-center text-[10px] font-mono text-glomalin-muted border border-glomalin-border rounded px-1.5 py-0.5 flex-shrink-0">
              esc
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="overflow-y-auto max-h-[min(60vh,420px)] py-1">
            {flatRows.length === 0 ? (
              <p className="px-4 py-6 text-sm font-mono text-glomalin-muted text-center">
                Nothing matches &ldquo;{query}&rdquo;
              </p>
            ) : (
              sections.map((section) => (
                <div key={section.label}>
                  <p className="px-4 pt-3 pb-1 text-[10px] font-mono font-medium uppercase tracking-widest text-glomalin-muted select-none">
                    {section.label}
                  </p>
                  {section.rows.map((row) => {
                    rowIndex += 1
                    const i = rowIndex
                    const isActive = i === activeIndex
                    const { label, sublabel, badge, chord, route } = describeRow(row)
                    const isCurrent = route ? pathname === route.split('?')[0] : false

                    return (
                      <button
                        key={row.key}
                        type="button"
                        data-row-index={i}
                        onClick={() => runRow(row)}
                        onMouseEnter={() => setActiveIndex(i)}
                        className={[
                          'relative w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                          isActive ? 'bg-glomalin-highlight' : 'hover:bg-glomalin-border/30',
                        ].join(' ')}
                      >
                        {isActive && (
                          <span
                            aria-hidden="true"
                            className="absolute left-0 inset-y-2 w-[3px] bg-glomalin-accent rounded-r-full"
                          />
                        )}

                        {badge && (
                          <span className="flex-shrink-0 text-[9px] font-mono uppercase tracking-wider text-glomalin-accent border border-glomalin-accent/30 rounded px-1.5 py-0.5">
                            {badge}
                          </span>
                        )}

                        <span className="min-w-0 flex-1">
                          <span className={[
                            'block text-sm font-sans truncate',
                            isCurrent ? 'text-glomalin-accent' : 'text-glomalin-text',
                          ].join(' ')}>
                            {label}
                          </span>
                          <span className="block text-[11px] font-mono text-glomalin-muted truncate mt-0.5">
                            {sublabel}
                          </span>
                        </span>

                        {isCurrent && (
                          <span className="flex-shrink-0 text-[10px] font-mono text-glomalin-accent">
                            current
                          </span>
                        )}
                        {chord && !isCurrent && (
                          <kbd className="hidden sm:flex flex-shrink-0 items-center text-[10px] font-mono text-glomalin-muted border border-glomalin-border rounded px-1.5 py-0.5">
                            {chord}
                          </kbd>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 px-4 py-2.5 border-t border-glomalin-border">
            <Hint k="↑↓" label="navigate" />
            <Hint k="↵" label="open" />
            <Hint k="&gt;" label="commands" />
            <Hint k="g" label="then m/b/t/h" />
          </div>
        </div>
      </div>
    </>
  )
}

function Hint({ k, label }: { k: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-[10px] font-mono text-glomalin-muted">
      <kbd className="border border-glomalin-border rounded px-1 py-0.5">{k}</kbd>
      {label}
    </span>
  )
}

function describeRow(row: Row): {
  label: string
  sublabel: string
  badge?: string
  chord?: string
  route?: string
} {
  switch (row.type) {
    case 'recent':
      return { label: row.label, sublabel: row.sublabel, route: row.route }
    case 'object':
      return {
        label: row.hit.label,
        sublabel: row.hit.sublabel,
        badge: row.hit.kind === 'field' ? 'field' : 'contract',
        route: row.hit.route,
      }
    case 'module':
      return {
        label: row.mod.label,
        sublabel: row.mod.sublabel,
        chord: CHORDS[row.mod.id],
        route: row.mod.route,
      }
    case 'page':
      return { label: row.page.label, sublabel: row.page.sublabel, route: row.page.route }
    case 'command':
      return { label: row.cmd.label, sublabel: row.cmd.sublabel }
  }
}
