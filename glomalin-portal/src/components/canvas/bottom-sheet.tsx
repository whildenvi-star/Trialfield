'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Three-detent bottom sheet for the map canvas.
 *
 * Follows the grammar Google/Apple Maps converged on:
 *   - peek / half / full, where "full" deliberately leaves a sliver of map
 *     showing at the top so the canvas never fully disappears — that sliver is
 *     the affordance that says "the map is still home"
 *   - non-modal: no scrim, and the map stays pannable behind it
 *   - below full, a vertical drag moves the sheet; at full, the content scrolls
 *     and only grabs the sheet once it is scrolled back to the top
 *   - velocity-aware snapping, so a fast flick from peek goes straight to full
 *
 * Deliberately not swipe-only: there is a visible grabber (tap cycles detents,
 * per Apple HIG) and a real close button, because dismissal that exists only as
 * a gesture is unusable with gloves and invisible to screen readers.
 */

const SLIVER_H = 72 // map left visible above a fully-expanded sheet
const PEEK_H = 96
const VELOCITY_SNAP = 0.5 // px/ms — above this, throw in the drag direction

export type Detent = 'peek' | 'half' | 'full'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  /** Shown in the peek row, so a collapsed sheet still says what it holds. */
  title: string
  subtitle?: string
  children: React.ReactNode
  /** Space to leave at the bottom, e.g. the 56px mobile tab bar. */
  bottomOffset?: number
  initialDetent?: Detent
}

export function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  bottomOffset = 0,
  initialDetent = 'half',
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    startY: number
    startOffset: number
    lastY: number
    lastT: number
    velocity: number
    active: boolean
  } | null>(null)

  const [detent, setDetent] = useState<Detent>(initialDetent)
  const [sheetH, setSheetH] = useState(0)
  const [dragOffset, setDragOffset] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)

  // Measure against the visual viewport so the on-screen keyboard and mobile
  // browser chrome don't leave the sheet sized to a viewport that isn't there.
  useEffect(() => {
    function measure() {
      const vh = window.visualViewport?.height ?? window.innerHeight
      setSheetH(Math.max(240, vh - SLIVER_H - bottomOffset))
    }
    measure()
    window.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('resize', measure)
    }
  }, [bottomOffset])

  /**
   * Detents are expressed as the sheet's *height*, with its bottom pinned above
   * the tab bar — not as a downward translation of a fixed-height panel. A
   * translated sheet keeps its full height and pushes its own bottom below the
   * viewport, so at peek and half the last rows of content sit off-screen where
   * no amount of scrolling reaches them.
   */
  const heightFor = useCallback(
    (d: Detent): number => {
      if (sheetH === 0) return 0
      const vh = window.visualViewport?.height ?? window.innerHeight
      switch (d) {
        case 'full': return sheetH
        case 'half': return Math.min(sheetH, Math.round(vh * 0.5))
        case 'peek': return Math.min(sheetH, PEEK_H)
      }
    },
    [sheetH]
  )

  // Reset to the opening detent each time the sheet is shown.
  useEffect(() => {
    if (open) setDetent(initialDetent)
  }, [open, initialDetent])

  const currentHeight = dragOffset ?? heightFor(detent)

  const snapTo = useCallback(
    (height: number, velocity: number) => {
      const order: Detent[] = ['full', 'half', 'peek']
      // A decisive flick wins over proximity. Positive velocity = dragging down
      // = toward a smaller sheet.
      if (Math.abs(velocity) > VELOCITY_SNAP) {
        const idx = order.indexOf(detent)
        if (velocity > 0 && detent === 'peek') { onClose(); return }
        setDetent(velocity > 0
          ? order[Math.min(idx + 1, order.length - 1)]
          : order[Math.max(idx - 1, 0)])
        return
      }
      // Dragged well below peek — dismiss rather than snapping back.
      if (height < PEEK_H * 0.6) { onClose(); return }
      let best: Detent = order[0]
      let bestDist = Infinity
      for (const c of order) {
        const d = Math.abs(heightFor(c) - height)
        if (d < bestDist) { bestDist = d; best = c }
      }
      setDetent(best)
    },
    [detent, heightFor, onClose]
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (sheetH === 0) return
      // At full detent, let the content scroll; the sheet only takes the drag
      // once the content is already back at the top.
      const scroller = scrollRef.current
      const startedInScroller = scroller?.contains(e.target as Node)
      if (detent === 'full' && startedInScroller && scroller && scroller.scrollTop > 0) return

      dragRef.current = {
        startY: e.clientY,
        startOffset: heightFor(detent),
        lastY: e.clientY,
        lastT: performance.now(),
        velocity: 0,
        active: true,
      }
      setDragging(true)
    },
    [detent, heightFor, sheetH]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current
      if (!d?.active) return
      const dy = e.clientY - d.startY

      // At full, an upward drag has nowhere to go — release it to the scroller.
      if (detent === 'full' && dy < 0) return

      const now = performance.now()
      const dt = now - d.lastT
      if (dt > 0) d.velocity = (e.clientY - d.lastY) / dt
      d.lastY = e.clientY
      d.lastT = now

      // Dragging down (positive dy) shrinks the sheet; its bottom stays pinned.
      const next = Math.min(Math.max(0, d.startOffset - dy), sheetH)
      setDragOffset(next)
      if (e.currentTarget.hasPointerCapture?.(e.pointerId) === false) {
        e.currentTarget.setPointerCapture?.(e.pointerId)
      }
    },
    [detent, sheetH]
  )

  const endDrag = useCallback(() => {
    const d = dragRef.current
    if (!d?.active) return
    d.active = false
    setDragging(false)
    const height = dragOffset
    setDragOffset(null)
    if (height != null) snapTo(height, d.velocity)
  }, [dragOffset, snapTo])

  // Tap the grabber to cycle detents — the pointer-free path through the sheet.
  const cycleDetent = useCallback(() => {
    setDetent((d) => (d === 'peek' ? 'half' : d === 'half' ? 'full' : 'peek'))
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    // Wrapper is inert so the map behind the sheet stays pannable — the sheet
    // itself re-enables pointer events.
    <div
      className="fixed inset-x-0 z-30 pointer-events-none"
      style={{ bottom: bottomOffset, height: sheetH || undefined }}
      aria-hidden={!open}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-label={title}
        className={[
          'absolute inset-x-0 bottom-0 pointer-events-auto flex flex-col',
          'bg-glomalin-canvas-surface border-t border-glomalin-canvas-border',
          'rounded-t-xl shadow-2xl',
          dragging
            ? ''
            : 'transition-[height,transform] duration-300 ease-out motion-reduce:transition-none',
        ].join(' ')}
        style={{
          height: currentHeight || undefined,
          // Closed: drop it clear of the viewport without changing its height,
          // so reopening animates from the right detent.
          transform: open ? undefined : 'translateY(100%)',
          touchAction: 'none',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {/* Grabber — tap cycles detents */}
        <button
          type="button"
          onClick={cycleDetent}
          aria-label={`Resize panel (currently ${detent})`}
          className="flex-shrink-0 w-full flex justify-center pt-2.5 pb-1.5 touch-manipulation"
        >
          <span className="block w-9 h-1 rounded-full bg-glomalin-canvas-border" />
        </button>

        {/* Peek row — a collapsed sheet still says what it holds */}
        <div className="flex-shrink-0 flex items-start justify-between gap-3 px-4 pb-3">
          <div className="min-w-0">
            <p className="text-glomalin-canvas-accent font-mono text-base font-semibold truncate">
              {title}
            </p>
            {subtitle && (
              <p className="text-glomalin-canvas-muted font-mono text-[11px] truncate mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="flex-shrink-0 -mt-1 -mr-1 w-9 h-9 flex items-center justify-center text-glomalin-canvas-muted active:text-glomalin-canvas-text touch-manipulation"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4"
          style={{ touchAction: detent === 'full' ? 'pan-y' : 'none' }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
