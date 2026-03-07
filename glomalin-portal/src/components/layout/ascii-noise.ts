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
    // Smooth interpolation using sine/cosine mix + noise
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
}

export interface Pulse {
  edgeIdx: number
  t: number   // 0..1 position along edge
  speed: number
}

// ── Character ramp & color palette ──────────────────────────────────

export const CHAR_RAMP = ' .\u00b7:;\u2591\u2592\u2593\u2588'

const COLOR_BRIGHTEST = '#22d3ee' // cyan-300 (>0.65)
const COLOR_MID       = '#0e7490' // cyan-700 (0.35–0.65)
const COLOR_DIM       = '#164e63' // cyan-900 (0.15–0.35)
const COLOR_FAINT     = '#0c2a3a' // (<0.15)

export function charColor(brightness: number): string {
  if (brightness > 0.65) return COLOR_BRIGHTEST
  if (brightness > 0.35) return COLOR_MID
  if (brightness > 0.15) return COLOR_DIM
  return COLOR_FAINT
}

export function charOpacity(brightness: number): number {
  return 0.3 + brightness * 0.6
}

// ── Generate mycelium brightness grid ───────────────────────────────

export function generateMycelium(
  cols: number,
  rows: number,
  time: number,
  nodes: MyceliumNode[],
  pulses: Pulse[],
  edges: [number, number][],
): Float32Array {
  const grid = new Float32Array(cols * rows)

  // Background spore texture via fbm
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const nx = c / cols * 4 + time * 0.02
      const ny = r / rows * 4 + time * 0.015
      grid[r * cols + c] = Math.max(0, fbm(nx, ny, 3, 42) * 0.12 - 0.02)
    }
  }

  // Draw connections between nodes
  for (let ei = 0; ei < edges.length; ei++) {
    const [ai, bi] = edges[ei]
    const a = nodes[ai]
    const b = nodes[bi]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const steps = Math.ceil(dist * Math.max(cols, rows) * 1.5)

    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      // Sine-wave wobble perpendicular to connection
      const wobble = Math.sin(t * Math.PI * 3 + time * 0.8 + ei) * 0.015
      const px = a.x + dx * t + (-dy / dist) * wobble
      const py = a.y + dy * t + (dx / dist) * wobble

      const col = Math.round(px * (cols - 1))
      const row = Math.round(py * (rows - 1))
      if (col >= 0 && col < cols && row >= 0 && row < rows) {
        // Fade at endpoints
        const edgeFade = Math.sin(t * Math.PI)
        grid[row * cols + col] = Math.min(1, grid[row * cols + col] + 0.3 * edgeFade)
      }
    }
  }

  // Draw pulses traveling along connections
  for (const pulse of pulses) {
    const [ai, bi] = edges[pulse.edgeIdx]
    const a = nodes[ai]
    const b = nodes[bi]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const px = a.x + dx * pulse.t
    const py = a.y + dy * pulse.t

    const col = Math.round(px * (cols - 1))
    const row = Math.round(py * (rows - 1))
    // Pulse glow radius
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

  // Draw node glow
  for (const node of nodes) {
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
            const glow = (1 - d * d) * 0.8
            grid[r * cols + c] = Math.min(1, grid[r * cols + c] + glow)
          }
        }
      }
    }
  }

  return grid
}
