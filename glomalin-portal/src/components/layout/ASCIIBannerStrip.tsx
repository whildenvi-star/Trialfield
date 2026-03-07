'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import {
  noise2D,
  generateMycelium,
  tickNodes,
  tickEdges,
  initEdgeStates,
  CHAR_RAMP,
  charColor,
  charOpacity,
  type MyceliumNode,
  type EdgeState,
  type Pulse,
} from './ascii-noise'

// ── Component ───────────────────────────────────────────────────────

interface ASCIIBannerStripProps {
  height?: number
  className?: string
  paused?: boolean
  nodeCount?: number
}

const DEFAULT_BG_COLOR = '#080a0f'
const DEFAULT_NODE_COUNT = 10

export default function ASCIIBannerStrip({
  height = 72,
  className,
  paused = false,
  nodeCount = DEFAULT_NODE_COUNT,
}: ASCIIBannerStripProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number>(0)
  const nodesRef = useRef<MyceliumNode[]>([])
  const edgesRef = useRef<[number, number][]>([])
  const edgeStatesRef = useRef<EdgeState[]>([])
  const pulsesRef = useRef<Pulse[]>([])
  const timeOffsetRef = useRef(Math.random() * 100)
  const [visible, setVisible] = useState(false)

  // Check reduced motion preference
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Initialize mycelium nodes with lifecycle
  const initNodes = useCallback((count: number) => {
    const now = Date.now() * 0.001 + timeOffsetRef.current
    const newNodes: MyceliumNode[] = []
    for (let i = 0; i < count; i++) {
      newNodes.push({
        x: 0.05 + Math.random() * 0.9,
        y: 0.1 + Math.random() * 0.8,
        vx: (Math.random() - 0.5) * 0.0003,
        vy: (Math.random() - 0.5) * 0.0003,
        radius: 0.02 + Math.random() * 0.015,
        birthTime: now - Math.random() * 10, // stagger initial births
        lifespan: 8 + Math.random() * 7,     // 8-15s
      })
    }
    nodesRef.current = newNodes

    // Build edges: connect nearby nodes (Delaunay-ish)
    const edges: [number, number][] = []
    for (let i = 0; i < count; i++) {
      const dists: { idx: number; d: number }[] = []
      for (let j = 0; j < count; j++) {
        if (i === j) continue
        const dx = newNodes[i].x - newNodes[j].x
        const dy = newNodes[i].y - newNodes[j].y
        dists.push({ idx: j, d: Math.sqrt(dx * dx + dy * dy) })
      }
      dists.sort((a, b) => a.d - b.d)
      const connectCount = 2 + Math.floor(Math.random() * 2)
      for (let k = 0; k < Math.min(connectCount, dists.length); k++) {
        const j = dists[k].idx
        if (!edges.some(([a, b]) => (a === i && b === j) || (a === j && b === i))) {
          edges.push([i, j])
        }
      }
    }
    edgesRef.current = edges

    // Initialize edge growth states (staggered)
    edgeStatesRef.current = initEdgeStates(edges.length, now)

    // Initial pulses
    pulsesRef.current = edges.slice(0, 4).map((_, idx) => ({
      edgeIdx: idx,
      t: Math.random(),
      speed: 0.002 + Math.random() * 0.003,
    }))
  }, [])

  const render = useCallback((canvas: HTMLCanvasElement, time: number) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = canvas.width / dpr
    const h = canvas.height / dpr

    const charH = 10
    const charW = charH * 0.6
    const cols = Math.floor(w / charW)
    const rows = Math.floor(h / charH)

    if (cols < 2 || rows < 1) return

    const nodes = nodesRef.current
    const edges = edgesRef.current
    const edgeStates = edgeStatesRef.current
    const pulses = pulsesRef.current

    // Tick node positions and lifecycle
    tickNodes(nodes, time, cols, rows)

    // Tick edge growth/retraction
    tickEdges(edgeStates, time)

    // Update pulses
    for (const pulse of pulses) {
      pulse.t += pulse.speed
      if (pulse.t > 1) {
        pulse.t = 0
        pulse.edgeIdx = Math.floor(Math.random() * edges.length)
        pulse.speed = 0.002 + Math.random() * 0.003
      }
    }

    // Generate brightness grid with tendril growth
    const grid = generateMycelium(cols, rows, time, nodes, pulses, edges, edgeStates)

    // Clear canvas
    ctx.clearRect(0, 0, w, h)

    // Render ASCII characters
    ctx.font = `${charH}px "Berkeley Mono", "JetBrains Mono", "Fira Code", monospace`
    ctx.textBaseline = 'top'

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const brightness = grid[r * cols + c]
        if (brightness < 0.01) continue

        const charIdx = Math.min(
          CHAR_RAMP.length - 1,
          Math.floor(brightness * (CHAR_RAMP.length - 1))
        )
        const ch = CHAR_RAMP[charIdx]
        if (ch === ' ') continue

        ctx.fillStyle = charColor(brightness)
        ctx.globalAlpha = charOpacity(brightness)
        ctx.fillText(ch, c * charW, r * charH)
      }
    }

    ctx.globalAlpha = 1

    // Bottom gradient overlay: transparent -> bgColor
    const grad = ctx.createLinearGradient(0, h * 0.65, 0, h)
    grad.addColorStop(0, 'transparent')
    grad.addColorStop(1, DEFAULT_BG_COLOR)
    ctx.fillStyle = grad
    ctx.fillRect(0, h * 0.65, w, h * 0.35)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    initNodes(nodeCount)

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = container.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.scale(dpr, dpr)
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
    }

    resize()

    // Debounced resize
    let resizeTimer: ReturnType<typeof setTimeout>
    const handleResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(resize, 150)
    }
    window.addEventListener('resize', handleResize)

    // Fade in
    requestAnimationFrame(() => setVisible(true))

    if (prefersReducedMotion) {
      // Single static frame using clock-based time
      render(canvas, Date.now() * 0.001 + timeOffsetRef.current)
    } else {
      // Animation loop — clock-based time for tab resume
      let lastFrame = 0
      const FRAME_INTERVAL = 1000 / 50 // ~50fps

      const loop = (timestamp: number) => {
        if (timestamp - lastFrame >= FRAME_INTERVAL) {
          lastFrame = timestamp
          if (!document.hidden) {
            // Clock-based time: animation progresses even when tab is hidden
            const animTime = Date.now() * 0.001 + timeOffsetRef.current
            render(canvas, animTime)
          }
        }
        animRef.current = requestAnimationFrame(loop)
      }
      animRef.current = requestAnimationFrame(loop)
    }

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', handleResize)
      clearTimeout(resizeTimer)
    }
  }, [initNodes, prefersReducedMotion, render, nodeCount])

  // Handle paused prop: stop/restart RAF loop
  useEffect(() => {
    if (prefersReducedMotion) return

    const canvas = canvasRef.current
    if (!canvas) return

    if (paused) {
      cancelAnimationFrame(animRef.current)
      animRef.current = 0
    } else if (animRef.current === 0) {
      // Restart animation loop — clock-based time
      let lastFrame = 0
      const FRAME_INTERVAL = 1000 / 50

      const loop = (timestamp: number) => {
        if (timestamp - lastFrame >= FRAME_INTERVAL) {
          lastFrame = timestamp
          if (!document.hidden) {
            const animTime = Date.now() * 0.001 + timeOffsetRef.current
            render(canvas, animTime)
          }
        }
        animRef.current = requestAnimationFrame(loop)
      }
      animRef.current = requestAnimationFrame(loop)
    }
  }, [paused, prefersReducedMotion, render])

  return (
    <div
      ref={containerRef}
      role="img"
      aria-hidden="true"
      className={`relative w-full overflow-hidden${className ? ` ${className}` : ''}`}
      style={{
        height,
        opacity: visible ? 1 : 0,
        transition: 'opacity 400ms ease-in',
      }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ background: 'transparent' }}
      />
    </div>
  )
}
