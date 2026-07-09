export type GeoJsonGeometry = {
  type: 'Polygon' | 'MultiPolygon'
  coordinates: number[][][] | number[][][][]
}

export function buildSvgThumb(geometry: GeoJsonGeometry | null, size = 32): string {
  if (!geometry?.coordinates) return _placeholder(size)

  const allBbox: number[][] = []
  const collectRing = (ring: number[][]) => ring.forEach(c => allBbox.push(c))

  if (geometry.type === 'Polygon') {
    const c = geometry.coordinates as number[][][]
    if (c[0]) collectRing(c[0])
  } else if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates as number[][][][]) {
      if (poly[0]) collectRing(poly[0])
    }
  } else {
    return _placeholder(size)
  }

  if (!allBbox.length) return _placeholder(size)

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const c of allBbox) {
    if (c[0] < minX) minX = c[0]; if (c[0] > maxX) maxX = c[0]
    if (c[1] < minY) minY = c[1]; if (c[1] > maxY) maxY = c[1]
  }

  const dX = maxX - minX || 0.001
  const dY = maxY - minY || 0.001
  const pad = size * 0.1
  const usable = size - 2 * pad
  const scale = Math.min(usable / dX, usable / dY)
  const offX = pad + (usable - dX * scale) / 2
  const offY = pad + (usable - dY * scale) / 2

  const px = (c: number[]) => [
    (offX + (c[0] - minX) * scale).toFixed(1),
    ((size - offY) - (c[1] - minY) * scale).toFixed(1),
  ]

  const ringPath = (ring: number[][]) =>
    ring.map((c, i) => `${i === 0 ? 'M' : 'L'}${px(c).join(' ')}`).join(' ') + ' Z'

  const paths: string[] = []
  if (geometry.type === 'Polygon') {
    ;(geometry.coordinates as number[][][]).forEach(r => paths.push(ringPath(r)))
  } else {
    ;(geometry.coordinates as number[][][][]).forEach(p => p.forEach(r => paths.push(ringPath(r))))
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display:block;flex-shrink:0;"><path d="${paths.join(' ')}" fill="rgba(139,115,85,0.13)" stroke="#8B7355" stroke-width="1.5" stroke-linejoin="round" fill-rule="evenodd"/></svg>`
}

function _placeholder(size: number): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display:block;flex-shrink:0;opacity:0.2;"><rect x="4" y="4" width="${size - 8}" height="${size - 8}" rx="2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="3 3"/></svg>`
}
