// ── Scene type system ────────────────────────────────────────────────

export type SceneType = 'mycelium' | 'drone' | 'seasonal'

export const SCENE_LIST: SceneType[] = ['mycelium', 'drone', 'seasonal']

/** Cycle to next scene in SCENE_LIST */
export function nextScene(current: SceneType): SceneType {
  const idx = SCENE_LIST.indexOf(current)
  return SCENE_LIST[(idx + 1) % SCENE_LIST.length]
}

/**
 * SceneRenderer: a function that generates a brightness grid.
 * Returns Float32Array of size cols*rows with values in 0..1 range.
 */
export interface SceneRenderer {
  (cols: number, rows: number, time: number): Float32Array
}
