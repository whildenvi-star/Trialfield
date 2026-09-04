'use client'

import { useEffect, useState } from 'react'

/**
 * Matches a media query, SSR-safe (returns false until mounted).
 *
 * Used to pick a *presentation* — right-docked panel vs bottom sheet — rather
 * than to hide content, so a first render at `false` degrades to the desktop
 * layout for one frame instead of dropping anything.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(query)
    const update = () => setMatches(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [query])

  return matches
}

/** Below Tailwind's md — where the canvas swaps panels for sheets. */
export function useIsCompact(): boolean {
  return useMediaQuery('(max-width: 767px)')
}
