'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import {
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
import type { SceneType } from './scene-types'
import { generateDroneLandscape } from './scene-drone'
import { generateSeasonal } from './scene-seasonal'
import { colors } from '@/lib/tokens'

// ── Component ───────────────────────────────────────────────────────

interface ASCIIBannerStripProps {
  height?: number
  className?: string
  paused?: boolean
  nodeCount?: number
  scene?: SceneType
  onNodeClick?: () => void
}

const DEFAULT_BG_COLOR = colors.bg
const DEFAULT_NODE_COUNT = 10
const CROSSFADE_DURATION = 200 // ms

export default function ASCIIBannerStrip({
  height = 72,
  className,
  paused = false,
  nodeCount = DEFAULT_NODE_COUNT,
  scene = 'mycelium',
  onNodeClick,
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

  // Scene transition state
  const activeSceneRef = useRef<SceneType>(scene)
  const prevSceneRef = useRef<SceneType | null>(null)
  const transitionStartRef = useRef<number>(0)

  // Track latest grid for click detection
  const lastGridRef = useRef<Float32Array | null>(null)
  const lastColsRef = useRef(0)
  const lastRowsRef = useRef(0)

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

  // Generate grid for a given scene type
  const generateGrid = useCallback((
    sceneType: SceneType,
    cols: number,
    rows: number,
    time: number,
    tickMycelium: boolean,
  ): Float32Array => {
    switch (sceneType) {
      case 'drone':
        return generateDroneLandscape(cols, rows, time)
      case 'seasonal':
        return generateSeasonal(cols, rows, time)
      case 'mycelium':
      default: {
        const nodes = nodesRef.current
        const edges = edgesRef.current
        const edgeStates = edgeStatesRef.current
        const pulses = pulsesRef.current

        if (tickMycelium) {
          // Tick node positions and lifecycle
          tickNodes(nodes, time)
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
        }

        return generateMycelium(cols, rows, time, nodes, pulses, edges, edgeStates)
      }
    }
  }, [])

  // Handle scene prop changes — trigger crossfade
  useEffect(() => {
    if (scene !== activeSceneRef.current) {
      prevSceneRef.current = activeSceneRef.current
      activeSceneRef.current = scene
      transitionStartRef.current = Date.now()
    }
  }, [scene])

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

    // Determine if transition is in progress
    const prevScene = prevSceneRef.current
    const activeScene = activeSceneRef.current
    let grid: Float32Array

    if (prevScene !== null) {
      // Crossfade in progress
      const progress = Math.min(1, (Date.now() - transitionStartRef.current) / CROSSFADE_DURATION)

      // Need mycelium tick if either scene is mycelium
      const needsMyceliumTick = prevScene === 'mycelium' || activeScene === 'mycelium'

      const prevGrid = generateGrid(prevScene, cols, rows, time, needsMyceliumTick)
      const activeGrid = generateGrid(activeScene, cols, rows, time, false)

      // Blend grids
      grid = new Float32Array(cols * rows)
      for (let i = 0; i < grid.length; i++) {
        grid[i] = prevGrid[i] * (1 - progress) + activeGrid[i] * progress
      }

      // End transition when complete
      if (progress >= 1.0) {
        prevSceneRef.current = null
      }
    } else {
      // No transition — render active scene only
      const needsMyceliumTick = activeScene === 'mycelium'
      grid = generateGrid(activeScene, cols, rows, time, needsMyceliumTick)
    }

    // Store grid for click detection
    lastGridRef.current = grid
    lastColsRef.current = cols
    lastRowsRef.current = rows

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
  }, [generateGrid])

  // Click handler for easter egg node detection
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onNodeClick) return

    const canvas = canvasRef.current
    if (!canvas) return

    const grid = lastGridRef.current
    if (!grid) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const charH = 10
    const charW = charH * 0.6
    const col = Math.floor(x / charW)
    const row = Math.floor(y / charH)

    const cols = lastColsRef.current
    const rows = lastRowsRef.current

    if (col >= 0 && col < cols && row >= 0 && row < rows) {
      const brightness = grid[row * cols + col]
      if (brightness > 0.65) {
        onNodeClick()
      }
    }
  }, [onNodeClick])

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
        onClick={handleCanvasClick}
      />
    </div>
  )
}
