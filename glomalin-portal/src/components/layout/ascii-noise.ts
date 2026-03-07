// ── Noise utilities (no external deps) ──────────────────────────────

export function noise2D(x: number, y: number, seed: number): number {
  const n = Math.sin(seed * 127.1 + x * 311.7 + y * 183.3) * 43758.5453
  return n - Math.floor(n)
}

export function fbm(x: number, y: number, octaves: number, seed: number): number {
  let value = 0
  let amplitude = 0.5
  let frequency = 1
  for (let i = 0; i < octaves; i++) {
    const nx = x * frequency
    const ny = y * frequency
    const n =
      Math.sin(nx * 1.2 + seed) * Math.cos(ny * 0.9 + seed * 0.7) * 0.5 +
      noise2D(Math.floor(nx), Math.floor(ny), seed + i) * 0.5
    value += n * amplitude
    amplitude *= 0.5
    frequency *= 2
  }
  return value * 0.5 + 0.5 // normalize to 0..1
}

// ── Mycelium types ──────────────────────────────────────────────────

export interface MyceliumNode {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  birthTime: number
  lifespan: number  // 8-15 seconds
}

export interface EdgeState {
  growthProgress: number   // 0..1 how far the tendril has grown
  phase: 'growing' | 'holding' | 'retracting' | 'idle'
  phaseStart: number       // time when current phase began
  growDuration: number     // 8-12s randomized
  holdDuration: number     // 2-4s randomized
  retractDuration: number  // 6-8s randomized
}

export interface Pulse {
  edgeIdx: number
  t: number   // 0..1 position along edge
  speed: number
}

// ── Character ramp & color palette ──────────────────────────────────

export const CHAR_RAMP = ' .\u00b7:;\u2591\u2592\u2593\u2588'

const COLOR_WHITE     = '#ffffff'    // peak highlights (>0.85)
const COLOR_BRIGHTEST = '#22d3ee'    // cyan-300 (0.65–0.85)
const COLOR_MID       = '#0e7490'    // cyan-700 (0.35–0.65)
const COLOR_DIM       = '#164e63'    // cyan-900 (0.15–0.35)
const COLOR_FAINT     = '#0c2a3a'    // (<0.15)

export function charColor(brightness: number): string {
  if (brightness > 0.85) return COLOR_WHITE
  if (brightness > 0.65) return COLOR_BRIGHTEST
  if (brightness > 0.35) return COLOR_MID
  if (brightness > 0.15) return COLOR_DIM
  return COLOR_FAINT
}

export function charOpacity(brightness: number): number {
  return 0.3 + brightness * 0.6
}

// ── Node lifecycle ──────────────────────────────────────────────────

/** Get lifecycle multiplier (0..1) for a node based on its age */
export function nodeLifecycleBrightness(node: MyceliumNode, time: number): number {
  const age = time - node.birthTime
  if (age < 0) return 0

  const fadeInDuration = 2.0
  const fadeOutDuration = 2.0
  const fadeOutStart = node.lifespan - fadeOutDuration

  if (age < fadeInDuration) {
    // Growing phase: ramp up
    return age / fadeInDuration
  } else if (age > fadeOutStart) {
    // Fading phase: ramp down
    const fadeProgress = (age - fadeOutStart) / fadeOutDuration
    return Math.max(0, 1 - fadeProgress)
  } else {
    // Active phase: full brightness
    return 1
  }
}

/** Tick nodes: update positions, respawn expired nodes */
export function tickNodes(
  nodes: MyceliumNode[],
  time: number,
): void {
  for (const node of nodes) {
    // Drift
    node.x += node.vx
    node.y += node.vy
    if (node.x < 0.02 || node.x > 0.98) node.vx *= -1
    if (node.y < 0.05 || node.y > 0.95) node.vy *= -1
    node.x = Math.max(0.02, Math.min(0.98, node.x))
    node.y = Math.max(0.05, Math.min(0.95, node.y))

    // Lifecycle: respawn when faded out
    const age = time - node.birthTime
    if (age > node.lifespan) {
      node.x = 0.05 + Math.random() * 0.9
      node.y = 0.1 + Math.random() * 0.8
      node.vx = (Math.random() - 0.5) * 0.0003
      node.vy = (Math.random() - 0.5) * 0.0003
      node.radius = 0.02 + Math.random() * 0.015
      node.birthTime = time
      node.lifespan = 8 + Math.random() * 7 // 8-15s
    }
  }
}

// ── Edge / tendril lifecycle ────────────────────────────────────────

export function initEdgeStates(count: number, time: number): EdgeState[] {
  const states: EdgeState[] = []
  for (let i = 0; i < count; i++) {
    states.push({
      growthProgress: 0,
      phase: 'growing',
      phaseStart: time - Math.random() * 8, // stagger start times
      growDuration: 8 + Math.random() * 4,
      holdDuration: 2 + Math.random() * 2,
      retractDuration: 6 + Math.random() * 2,
    })
  }
  return states
}

export function tickEdges(edgeStates: EdgeState[], time: number): void {
  for (const es of edgeStates) {
    const elapsed = time - es.phaseStart

    switch (es.phase) {
      case 'growing': {
        es.growthProgress = Math.min(1, elapsed / es.growDuration)
        if (es.growthProgress >= 1) {
          es.phase = 'holding'
          es.phaseStart = time
        }
        break
      }
      case 'holding': {
        es.growthProgress = 1
        if (elapsed >= es.holdDuration) {
          es.phase = 'retracting'
          es.phaseStart = time
        }
        break
      }
      case 'retracting': {
        es.growthProgress = Math.max(0, 1 - elapsed / es.retractDuration)
        if (es.growthProgress <= 0) {
          es.phase = 'idle'
          es.phaseStart = time
        }
        break
      }
      case 'idle': {
        es.growthProgress = 0
        // After a short pause, start growing again
        if (elapsed >= 1.0 + Math.random() * 2) {
          es.phase = 'growing'
          es.phaseStart = time
          es.growDuration = 8 + Math.random() * 4
          es.holdDuration = 2 + Math.random() * 2
          es.retractDuration = 6 + Math.random() * 2
        }
        break
      }
    }
  }
}

// ── Generate mycelium brightness grid ───────────────────────────────

export function generateMycelium(
  cols: number,
  rows: number,
  time: number,
  nodes: MyceliumNode[],
  pulses: Pulse[],
  edges: [number, number][],
  edgeStates?: EdgeState[],
): Float32Array {
  const grid = new Float32Array(cols * rows)

  // Background spore texture via fbm — very sparse (0.03-0.05 max)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const nx = c / cols * 4 + time * 0.02
      const ny = r / rows * 4 + time * 0.015
      grid[r * cols + c] = Math.max(0, fbm(nx, ny, 3, 42) * 0.05 - 0.01)
    }
  }

  // Draw tendril connections between nodes
  for (let ei = 0; ei < edges.length; ei++) {
    const [ai, bi] = edges[ei]
    const a = nodes[ai]
    const b = nodes[bi]

    // Lifecycle brightness for connected nodes
    const aLife = nodeLifecycleBrightness(a, time)
    const bLife = nodeLifecycleBrightness(b, time)
    const edgeLife = Math.min(aLife, bLife)
    if (edgeLife < 0.01) continue

    // Tendril growth progress
    const growth = edgeStates ? edgeStates[ei]?.growthProgress ?? 1 : 1
    if (growth < 0.01) continue

    const dx = b.x - a.x
    const dy = b.y - a.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 0.001) continue

    // Normal perpendicular to edge direction
    const nx = -dy / dist
    const ny = dx / dist

    const steps = Math.ceil(dist * Math.max(cols, rows) * 1.5)
    const drawSteps = Math.ceil(steps * growth)

    for (let s = 0; s <= drawSteps; s++) {
      const t = s / steps

      // Noise-based jitter perpendicular to path (digital/glitchy feel)
      const jitterSeed = ei * 73.1 + t * 17.3
      const jitter = (noise2D(Math.floor(t * 20), ei, jitterSeed) - 0.5) * 0.025
      const px = a.x + dx * t + nx * jitter
      const py = a.y + dy * t + ny * jitter

      const col = Math.round(px * (cols - 1))
      const row = Math.round(py * (rows - 1))
      if (col >= 0 && col < cols && row >= 0 && row < rows) {
        // Fade at tip and endpoints
        const tipFade = s === drawSteps ? 0.5 : 1
        const endFade = Math.sin(t * Math.PI)
        const intensity = 0.25 * endFade * edgeLife * tipFade
        grid[row * cols + col] = Math.min(1, grid[row * cols + col] + intensity)
      }
    }

    // Occasional forks when growth > 0.5
    if (growth > 0.5) {
      const forkCount = 1 + Math.floor(noise2D(ei, 0, 99) * 2.5) // 1-3 forks
      for (let f = 0; f < forkCount; f++) {
        const forkT = 0.3 + noise2D(ei, f, 55) * 0.4 // fork at 30-70% along edge
        if (forkT > growth) continue

        // Fork angle: 20-40 degrees off the main path
        const angleOffset = (20 + noise2D(ei, f, 77) * 20) * Math.PI / 180
        const sign = noise2D(ei, f, 33) > 0.5 ? 1 : -1
        const forkAngle = Math.atan2(dy, dx) + sign * angleOffset

        const forkDx = Math.cos(forkAngle)
        const forkDy = Math.sin(forkAngle)
        const forkLen = 0.03 + noise2D(ei, f, 44) * 0.04 // short branches

        const startX = a.x + dx * forkT
        const startY = a.y + dy * forkT
        const maxForkSteps = 8

        for (let fs = 0; fs < maxForkSteps; fs++) {
          const ft = fs / maxForkSteps
          const fpx = startX + forkDx * forkLen * ft
          const fpy = startY + forkDy * forkLen * ft

          const fcol = Math.round(fpx * (cols - 1))
          const frow = Math.round(fpy * (rows - 1))
          if (fcol >= 0 && fcol < cols && frow >= 0 && frow < rows) {
            const forkFade = (1 - ft) * edgeLife * 0.2
            grid[frow * cols + fcol] = Math.min(1, grid[frow * cols + fcol] + forkFade)
          }
        }
      }
    }
  }

  // Draw pulses traveling along connections
  for (const pulse of pulses) {
    if (pulse.edgeIdx >= edges.length) continue
    const [ai, bi] = edges[pulse.edgeIdx]
    const a = nodes[ai]
    const b = nodes[bi]
    const pdx = b.x - a.x
    const pdy = b.y - a.y
    const px = a.x + pdx * pulse.t
    const py = a.y + pdy * pulse.t

    const col = Math.round(px * (cols - 1))
    const row = Math.round(py * (rows - 1))
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = row + dr
        const c = col + dc
        if (r >= 0 && r < rows && c >= 0 && c < cols) {
          const falloff = 1 - Math.sqrt(dr * dr + dc * dc) * 0.4
          grid[r * cols + c] = Math.min(1, grid[r * cols + c] + 0.6 * Math.max(0, falloff))
        }
      }
    }
  }

  // Draw node glow (modulated by lifecycle)
  for (const node of nodes) {
    const lifecycle = nodeLifecycleBrightness(node, time)
    if (lifecycle < 0.01) continue

    const col = Math.round(node.x * (cols - 1))
    const row = Math.round(node.y * (rows - 1))
    const glowR = Math.ceil(node.radius * Math.min(cols, rows))

    for (let dr = -glowR; dr <= glowR; dr++) {
      for (let dc = -glowR; dc <= glowR; dc++) {
        const r = row + dr
        const c = col + dc
        if (r >= 0 && r < rows && c >= 0 && c < cols) {
          const d = Math.sqrt(dr * dr + dc * dc) / glowR
          if (d <= 1) {
            const glow = (1 - d * d) * 0.8 * lifecycle
            grid[r * cols + c] = Math.min(1, grid[r * cols + c] + glow)
          }
        }
      }
    }
  }

  return grid
}
