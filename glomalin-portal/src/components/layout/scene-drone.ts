// ── Drone landscape scene ────────────────────────────────────────────
// Top-down drone view of rolling farmland with crop rows, clouds, depth fog

import { noise2D, fbm } from './ascii-noise'

// Seed offsets to ensure visually distinct patterns from mycelium (seed 42)
const TERRAIN_SEED = 142
const CROP_SEED = 217
const CLOUD_SEED = 331

/**
 * Generate a rolling landscape viewed from above (drone perspective).
 * Layers: terrain height, crop rows, cloud shadows, depth fog.
 */
export function generateDroneLandscape(
  cols: number,
  rows: number,
  time: number,
): Float32Array {
  const grid = new Float32Array(cols * rows)

  for (let r = 0; r < rows; r++) {
    // Depth fog: top rows (far) are dimmer, bottom rows (close) are brighter
    const depthFog = 0.3 + 0.7 * (r / (rows - 1))

    for (let c = 0; c < cols; c++) {
      // Normalized coordinates with slow downward drift
      const nx = c / cols * 3
      const ny = r / rows * 3 + time * 0.03

      // Layer 1: Ground terrain via fbm (4 octaves)
      const terrain = fbm(nx, ny, 4, TERRAIN_SEED)
      // Map terrain height to brightness (higher = brighter, sunlit hills)
      let brightness = terrain * 0.6 + 0.1

      // Layer 2: Crop rows — horizontal bands at regular intervals
      // Only visible on lower terrain (valleys)
      if (terrain < 0.55) {
        const rowInterval = 3.5
        const rowPhase = (r + time * 0.5) % rowInterval
        const rowStrength = rowPhase < 1.2 ? 1.0 : 0.0
        // Undulate with noise for natural irregularity
        const undulation = noise2D(Math.floor(c * 0.3), Math.floor(r * 0.2), CROP_SEED)
        const cropBrightness = rowStrength * (0.1 + undulation * 0.1)
        brightness += cropBrightness
      }

      // Layer 3: Cloud shadows (fbm 2 octaves, faster drift)
      const cloudNx = c / cols * 1.5
      const cloudNy = r / rows * 1.5 + time * 0.08
      const cloud = fbm(cloudNx, cloudNy, 2, CLOUD_SEED)
      // Clouds reduce brightness where they overlap (large blobby shapes)
      const cloudShadow = cloud > 0.45 ? 0.3 + (1 - cloud) * 0.8 : 1.0
      brightness *= cloudShadow

      // Layer 4: Apply depth fog
      brightness *= depthFog

      // Clamp to usable range (comparable to mycelium 0.0-0.8)
      grid[r * cols + c] = Math.max(0, Math.min(0.8, brightness))
    }
  }

  return grid
}
