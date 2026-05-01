/**
 * FSA Shapefile ingestion library.
 *
 * Parses Rock County FSA CLU shapefiles (NAD83 UTM Zone 16N) and normalises
 * them to WGS84 GeoJSON for insertion into the clu_boundaries table.
 *
 * The `shapefile` npm package is CJS-compatible and works in Next.js API routes.
 * shpjs v6 is browser-only and must NOT be used server-side.
 */

import proj4 from 'proj4'

// NAD83 UTM Zone 16N — the projection used by Rock County FSA shapefiles.
// EPSG:26916
const NAD83_UTM16N =
  '+proj=utm +zone=16 +ellps=GRS80 +datum=NAD83 +units=m +no_defs'
const WGS84 = '+proj=longlat +datum=WGS84 +no_defs'

export interface CluFeature {
  farmNumber: string
  tractNumber: string
  cluLabel: string       // stringified CLUNBR
  cluId: string          // CLUID guid from FSA
  calcAcres: number
  fsaAcres: number
  geometry: GeoJSON.Polygon
  fsaAttributes: Record<string, unknown>  // all original .dbf fields verbatim
}

export interface ImportResult {
  farmNumber: string
  features: CluFeature[]
  errors: string[]
}

/** Reproject a single [x, y] coordinate from NAD83 UTM16N to WGS84 [lng, lat]. */
function reproject(coord: [number, number]): [number, number] {
  return proj4(NAD83_UTM16N, WGS84, coord) as [number, number]
}

/** Reproject every coordinate in a GeoJSON polygon ring. */
function reprojectRing(ring: number[][]): number[][] {
  return ring.map((c) => reproject(c as [number, number]))
}

/** Reproject a full GeoJSON Polygon geometry from NAD83 UTM16N to WGS84. */
function reprojectPolygon(geometry: GeoJSON.Geometry): GeoJSON.Polygon {
  if (geometry.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: geometry.coordinates.map(reprojectRing),
    }
  }
  // MultiPolygon: take the largest ring as a single polygon
  if (geometry.type === 'MultiPolygon') {
    const largest = geometry.coordinates.reduce((a, b) =>
      a[0].length >= b[0].length ? a : b
    )
    return {
      type: 'Polygon',
      coordinates: largest.map(reprojectRing),
    }
  }
  throw new Error(`Unsupported geometry type: ${geometry.type}`)
}

/**
 * Parse a single FSA shapefile set (.shp + .dbf) and return normalised features.
 * The `farmNumber` is derived from the filename (e.g., "14904" from "14904.shp").
 * All original .dbf fields are preserved verbatim in fsaAttributes.
 */
export async function parseShapefileSet(
  shpBuffer: ArrayBuffer,
  dbfBuffer: ArrayBuffer,
  farmNumber: string
): Promise<ImportResult> {
  // Dynamic import so Next.js doesn't attempt to bundle for client
  const shapefile = (await import('shapefile')) as typeof import('shapefile')

  const features: CluFeature[] = []
  const errors: string[] = []

  try {
    const source = await shapefile.open(shpBuffer, dbfBuffer)

    while (true) {
      const result = await source.read()
      if (result.done) break

      const feat = result.value
      if (!feat || !feat.geometry) {
        errors.push(`Null geometry skipped`)
        continue
      }

      let geometry: GeoJSON.Polygon
      try {
        geometry = reprojectPolygon(feat.geometry as GeoJSON.Geometry)
      } catch (e) {
        errors.push(`Geometry error on CLUNBR ${feat.properties?.CLUNBR}: ${e}`)
        continue
      }

      const props = feat.properties as Record<string, unknown>
      const cluLabel = String(props.CLUNBR ?? '').trim()
      const tractNumber = String(props.TRACTNBR ?? '').trim()

      features.push({
        farmNumber,
        tractNumber,
        cluLabel,
        cluId: String(props.CLUID ?? ''),
        calcAcres: Number(props.CALCACRES ?? 0),
        fsaAcres: Number(props.FSA_ACRES ?? 0),
        geometry,
        fsaAttributes: props,
      })
    }
  } catch (e) {
    errors.push(`Parse failed: ${e}`)
  }

  return { farmNumber, features, errors }
}

/**
 * Parse a ZIP buffer containing multiple shapefile sets (one per farm).
 * Returns one ImportResult per farm file found in the ZIP.
 *
 * NOTE: shpjs is browser-only; ZIP parsing is done via the `shapefile`
 * package's individual file approach instead.
 */
export async function parseShapefileZip(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _zipBuffer: ArrayBuffer
): Promise<ImportResult[]> {
  // ZIP parsing requires a browser-compatible library (shpjs) which can't run
  // server-side. For the admin import flow, accept individual .shp/.dbf pairs
  // via multipart form, or use the filesystem import script for initial load.
  throw new Error(
    'ZIP parsing not supported server-side. Use the filesystem import script ' +
    'or upload individual .shp and .dbf files.'
  )
}
