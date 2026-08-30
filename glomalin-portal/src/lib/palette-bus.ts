/**
 * Lets any component open the command palette without prop-drilling from the
 * protected layout.
 *
 * This exists because the palette must never be keyboard-only: ⌘K has no
 * equivalent on a phone in a tractor cab, so the mobile header's search button
 * and the desktop search pill both need to open the same component. One palette,
 * two doorways — recall for the expert, recognition for everyone else.
 */

export const PALETTE_OPEN_EVENT = 'glomalin:palette-open'

export interface PaletteOpenDetail {
  /** Seed the input, e.g. '>' to land straight in commands. */
  query?: string
}

export function openCommandPalette(query = ''): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<PaletteOpenDetail>(PALETTE_OPEN_EVENT, { detail: { query } })
  )
}

// ─── Recents ──────────────────────────────────────────────────────────────────
// An empty palette is a pure recall task; seeding it with what you just touched
// turns it back into recognition. Also serves as the de facto back-stack.

const RECENTS_KEY = 'glomalin-palette-recents'
const RECENTS_MAX = 8

export interface RecentEntry {
  /** Stable key: `${kind}:${id}` so a field and a module never collide. */
  key: string
  label: string
  sublabel: string
  route: string
  kind: 'module' | 'page' | 'field'
  at: number
}

export function readRecents(): RecentEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(RECENTS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return (parsed as RecentEntry[])
      .filter((e) => e && typeof e.key === 'string' && typeof e.route === 'string')
      .slice(0, RECENTS_MAX)
  } catch {
    return []
  }
}

export function pushRecent(entry: Omit<RecentEntry, 'at'>): void {
  if (typeof window === 'undefined') return
  try {
    const next = [
      { ...entry, at: Date.now() },
      ...readRecents().filter((e) => e.key !== entry.key),
    ].slice(0, RECENTS_MAX)
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
  } catch {
    // Private mode / blocked storage — recents are a convenience, never required.
  }
}
