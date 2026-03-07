// ── Seasonal scene renderer ──────────────────────────────────────────
// Auto-selects animation based on current calendar month.
// Each season has a distinct visual: planting, growth, harvest, dormant.

import { noise2D, fbm } from './ascii-noise'

export type Season = 'spring' | 'summer' | 'fall' | 'winter'

// Seed offsets (200+) to differentiate from mycelium (42) and drone (142+)
const SPRING_SEED = 211
const SUMMER_SEED = 237
const FALL_SEED = 259
const WINTER_SEED = 283

/**
 * Get the season for a given 0-indexed month (Date.getMonth()).
 * March-May = spring, June-August = summer, September-November = fall, December-February = winter
 */
export function getSeasonForMonth(month: number): Season {
  if (month >= 2 && month <= 4) return 'spring'
  if (month >= 5 && month <= 7) return 'summer'
  if (month >= 8 && month <= 10) return 'fall'
  return 'winter' // 11, 0, 1
}

// ── Spring: Planting ─────────────────────────────────────────────────
// Scattered bright dots representing seeds being dropped into soil.
// Horizontal rows of dots appear sequentially left to right.

function generateSpring(cols: number, rows: number, time: number): Float32Array {
  const grid = new Float32Array(cols * rows)

  // Very dim soil background
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const nx = c / cols * 5 + time * 0.01
      const ny = r / rows * 5
      grid[r * cols + c] = Math.max(0, fbm(nx, ny, 2, SPRING_SEED) * 0.04 - 0.01)
    }
  }

  // Planting rows: staggered horizontal lines with a sweeping cursor
  const plantingRows = 5 + Math.floor(rows * 0.3)
  const rowSpacing = Math.max(2, Math.floor(rows / plantingRows))
  const cursor = Math.floor(time * 2) % cols // sweeping planting cursor

  for (let pr = 0; pr < plantingRows; pr++) {
    const r = 1 + pr * rowSpacing
    if (r >= rows) break

    // Stagger: each row has a time offset
    const rowOffset = pr * Math.floor(cols * 0.15)
    const effectiveCursor = (cursor + cols - rowOffset % cols) % cols

    // Seed spacing within row
    const seedSpacing = 4 + Math.floor(noise2D(pr, 0, SPRING_SEED) * 3)

    for (let c = 0; c < cols; c++) {
      // Only show seeds behind the cursor (already planted)
      if (c > effectiveCursor) continue

      // Seeds at regular intervals with slight noise jitter
      const isSeedPosition = c % seedSpacing === 0
      if (!isSeedPosition) continue

      // Seed brightness with slight variation
      const seedNoise = noise2D(c, pr, SPRING_SEED + 50)
      const brightness = 0.4 + seedNoise * 0.2

      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        grid[r * cols + c] = Math.min(1, grid[r * cols + c] + brightness)
      }
    }

    // Bright cursor dot for active planting row
    if (effectiveCursor >= 0 && effectiveCursor < cols && r < rows) {
      grid[r * cols + effectiveCursor] = Math.min(1, grid[r * cols + effectiveCursor] + 0.7)
    }
  }

  return grid
}

// ── Summer: Growth ───────────────────────────────────────────────────
// Vertical lines growing upward from the bottom. Stems with leaf clusters.

function generateSummer(cols: number, rows: number, time: number): Float32Array {
  const grid = new Float32Array(cols * rows)

  // Dim background
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const nx = c / cols * 4 + time * 0.005
      const ny = r / rows * 4
      grid[r * cols + c] = Math.max(0, fbm(nx, ny, 2, SUMMER_SEED) * 0.03)
    }
  }

  // Plant stems growing upward
  const stemCount = Math.max(4, Math.floor(cols * 0.12))
  const stemSpacing = Math.floor(cols / stemCount)

  for (let s = 0; s < stemCount; s++) {
    const baseCol = Math.floor(stemSpacing * 0.5) + s * stemSpacing
    if (baseCol >= cols) break

    // Each stem has noise-determined max height, growing with time
    const maxHeightFrac = 0.3 + noise2D(s, 0, SUMMER_SEED + 10) * 0.4 // 30-70% of rows
    const growthProgress = Math.min(1, time * 0.05) // caps growth
    const stemHeight = Math.floor(rows * maxHeightFrac * growthProgress)

    // Draw stem from bottom upward
    for (let h = 0; h < stemHeight; h++) {
      const r = rows - 1 - h
      if (r < 0) break

      // Stem brightness: slightly brighter near top
      const heightFrac = h / Math.max(1, stemHeight)
      const brightness = 0.3 + heightFrac * 0.2

      // Slight horizontal wobble via noise
      const wobble = Math.round((noise2D(h, s, SUMMER_SEED + 30) - 0.5) * 1.5)
      const c = baseCol + wobble
      if (c >= 0 && c < cols) {
        grid[r * cols + c] = Math.min(1, grid[r * cols + c] + brightness)
      }
    }

    // Leaf clusters near stem top
    if (stemHeight > 3) {
      const topRow = rows - 1 - stemHeight
      const leafRadius = 2
      for (let dr = -leafRadius; dr <= leafRadius; dr++) {
        for (let dc = -leafRadius; dc <= leafRadius; dc++) {
          const lr = topRow + dr
          const lc = baseCol + dc
          if (lr >= 0 && lr < rows && lc >= 0 && lc < cols) {
            const dist = Math.sqrt(dr * dr + dc * dc)
            if (dist <= leafRadius) {
              const leafNoise = noise2D(lr, lc, SUMMER_SEED + 60)
              if (leafNoise > 0.35) {
                const leafBright = (1 - dist / leafRadius) * (0.5 + leafNoise * 0.3)
                grid[lr * cols + lc] = Math.min(1, grid[lr * cols + lc] + leafBright)
              }
            }
          }
        }
      }
    }
  }

  return grid
}

// ── Fall: Harvest ────────────────────────────────────────────────────
// Particles falling downward. Ground accumulates where they land.

function generateFall(cols: number, rows: number, time: number): Float32Array {
  const grid = new Float32Array(cols * rows)

  // Very dim background
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      grid[r * cols + c] = Math.max(0, fbm(c / cols * 3, r / rows * 3, 2, FALL_SEED) * 0.03)
    }
  }

  // Falling particles
  const particleCount = Math.max(8, Math.floor(cols * 0.15))
  for (let p = 0; p < particleCount; p++) {
    // Deterministic X position per particle (seeded by index)
    const px = Math.floor(noise2D(p, 0, FALL_SEED + 20) * cols)

    // Y position wraps with time offset per particle
    const speed = 1.5 + noise2D(p, 1, FALL_SEED + 40) * 2
    const yOffset = noise2D(p, 2, FALL_SEED + 60) * rows
    const py = Math.floor((time * speed + yOffset) % rows)

    // Draw particle with small trail
    for (let trail = 0; trail < 3; trail++) {
      const r = py - trail
      if (r >= 0 && r < rows && px >= 0 && px < cols) {
        const brightness = (0.7 - trail * 0.15)
        grid[r * cols + px] = Math.min(1, grid[r * cols + px] + brightness)
      }
    }
  }

  // Ground accumulation at bottom 2 rows
  for (let r = rows - 2; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Accumulation based on particle density near this column
      let accumulation = 0
      for (let p = 0; p < particleCount; p++) {
        const px = Math.floor(noise2D(p, 0, FALL_SEED + 20) * cols)
        const dist = Math.abs(px - c)
        if (dist <= 2) {
          accumulation += (1 - dist / 3) * 0.15
        }
      }
      // Slight time-based growth
      accumulation *= Math.min(1, time * 0.02 + 0.3)
      const rowFade = r === rows - 1 ? 1.0 : 0.6
      grid[r * cols + c] = Math.min(0.6, grid[r * cols + c] + accumulation * rowFade)
    }
  }

  return grid
}

// ── Winter: Dormant ──────────────────────────────────────────────────
// Very sparse, slow-moving noise. A few bright nodes pulse slowly.

function generateWinter(cols: number, rows: number, time: number): Float32Array {
  const grid = new Float32Array(cols * rows)

  // Very low amplitude fbm background
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const nx = c / cols * 3 + time * 0.008
      const ny = r / rows * 3 + time * 0.006
      grid[r * cols + c] = Math.max(0, fbm(nx, ny, 3, WINTER_SEED) * 0.15)
    }
  }

  // 3-4 scattered bright nodes that pulse with sin(time)
  const nodeCount = 3 + Math.floor(noise2D(0, 0, WINTER_SEED + 10))
  for (let n = 0; n < nodeCount; n++) {
    const nx = Math.floor(noise2D(n, 0, WINTER_SEED + 20) * (cols - 4)) + 2
    const ny = Math.floor(noise2D(n, 1, WINTER_SEED + 30) * (rows - 2)) + 1

    // Slow pulse: each node has offset phase
    const phase = n * 2.1
    const pulse = 0.3 + 0.4 * (Math.sin(time * 0.3 + phase) * 0.5 + 0.5)

    // Glow radius of 2 cells
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const r = ny + dr
        const c = nx + dc
        if (r >= 0 && r < rows && c >= 0 && c < cols) {
          const dist = Math.sqrt(dr * dr + dc * dc)
          if (dist <= 2) {
            const glow = (1 - dist / 2.5) * pulse
            grid[r * cols + c] = Math.min(1, grid[r * cols + c] + glow)
          }
        }
      }
    }
  }

  return grid
}

// ── Main entry point ─────────────────────────────────────────────────

/**
 * Generate a seasonal brightness grid. Auto-selects season by current month.
 */
export function generateSeasonal(
  cols: number,
  rows: number,
  time: number,
): Float32Array {
  const season = getSeasonForMonth(new Date().getMonth())

  switch (season) {
    case 'spring': return generateSpring(cols, rows, time)
    case 'summer': return generateSummer(cols, rows, time)
    case 'fall':   return generateFall(cols, rows, time)
    case 'winter': return generateWinter(cols, rows, time)
  }
}
