import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'
import { CURRENT_CROP_YEAR } from '@/lib/config'

// GET /api/fsa/export-shapefile?year=2026&confirmed_only=true
//
// Returns a .zip containing four shapefile components (CLU polygons):
//   clu-export-YYYY.shp  — geometry (ESRI Polygon, WGS84)
//   clu-export-YYYY.shx  — index
//   clu-export-YYYY.dbf  — attributes (FSA fields + glm_* zone fields)
//   clu-export-YYYY.prj  — WGS84 WKT projection
//
// Opens cleanly in QGIS, ArcGIS, and SMS Advanced.

// ── Shapefile constants ───────────────────────────────────────────────────────

const SHAPE_TYPE_POLYGON = 5
const WGS84_PRJ =
  'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",' +
  'SPHEROID["WGS_1984",6378137.0,298.257223563]],' +
  'PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]'

// ── Types ─────────────────────────────────────────────────────────────────────

type Ring = number[][]   // [[lng, lat], ...]
type Rings = Ring[]      // first ring = outer boundary, rest = holes

interface ShpRecord {
  rings: Rings
  bbox: [number, number, number, number]  // xmin, ymin, xmax, ymax
}

interface DbfField {
  name:      string    // max 10 chars
  type:      'C' | 'N'
  length:    number
  decimals?: number
}

// ── GeoJSON → rings ───────────────────────────────────────────────────────────

function geojsonToRings(raw: string | null): Rings {
  if (!raw) return []
  try {
    const geom = JSON.parse(raw) as { type: string; coordinates: unknown }
    if (geom.type === 'Polygon') {
      return geom.coordinates as Rings
    }
    if (geom.type === 'MultiPolygon') {
      const rings: Rings = []
      for (const polygon of geom.coordinates as Ring[][]) {
        for (const ring of polygon) rings.push(ring)
      }
      return rings
    }
  } catch { /* skip malformed */ }
  return []
}

function ringBbox(rings: Rings): [number, number, number, number] {
  let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < xmin) xmin = x
      if (x > xmax) xmax = x
      if (y < ymin) ymin = y
      if (y > ymax) ymax = y
    }
  }
  return isFinite(xmin) ? [xmin, ymin, xmax, ymax] : [0, 0, 0, 0]
}

// ── SHP + SHX builder ─────────────────────────────────────────────────────────

function buildShpAndShx(records: ShpRecord[]): { shp: Buffer; shx: Buffer } {
  // Pre-compute content byte size for each record:
  // 4 (shape type) + 32 (bbox) + 4 (num_parts) + 4 (num_points)
  // + num_parts×4 (parts array) + num_points×16 (points)
  const contentSizes = records.map((r) => {
    const numPts = r.rings.reduce((s, ring) => s + ring.length, 0)
    return 4 + 32 + 4 + 4 + r.rings.length * 4 + numPts * 16
  })

  const shpSize = 100 + contentSizes.reduce((s, n) => s + 8 + n, 0)
  const shxSize = 100 + records.length * 8

  const shp = Buffer.alloc(shpSize, 0)
  const shx = Buffer.alloc(shxSize, 0)

  // Global bbox
  let gxmin = Infinity, gymin = Infinity, gxmax = -Infinity, gymax = -Infinity
  for (const r of records) {
    if (r.bbox[0] < gxmin) gxmin = r.bbox[0]
    if (r.bbox[1] < gymin) gymin = r.bbox[1]
    if (r.bbox[2] > gxmax) gxmax = r.bbox[2]
    if (r.bbox[3] > gymax) gymax = r.bbox[3]
  }
  if (!isFinite(gxmin)) { gxmin = 0; gymin = 0; gxmax = 0; gymax = 0 }

  function writeHeader(buf: Buffer, fileLenBytes: number) {
    buf.writeInt32BE(9994, 0)
    buf.writeInt32BE(fileLenBytes / 2, 24)
    buf.writeInt32LE(1000, 28)
    buf.writeInt32LE(SHAPE_TYPE_POLYGON, 32)
    buf.writeDoubleLE(gxmin, 36)
    buf.writeDoubleLE(gymin, 44)
    buf.writeDoubleLE(gxmax, 52)
    buf.writeDoubleLE(gymax, 60)
  }
  writeHeader(shp, shpSize)
  writeHeader(shx, shxSize)

  let shpOff = 100
  let shxOff = 100

  for (let i = 0; i < records.length; i++) {
    const rec        = records[i]
    const contentLen = contentSizes[i]
    const recNum     = i + 1
    const numPts     = rec.rings.reduce((s, r) => s + r.length, 0)
    const numParts   = rec.rings.length

    // SHX entry — points to record header in shp file
    shx.writeInt32BE(shpOff / 2, shxOff)
    shx.writeInt32BE(contentLen / 2, shxOff + 4)
    shxOff += 8

    // SHP: record header
    shp.writeInt32BE(recNum, shpOff);           shpOff += 4
    shp.writeInt32BE(contentLen / 2, shpOff);   shpOff += 4

    // SHP: record content
    shp.writeInt32LE(SHAPE_TYPE_POLYGON, shpOff);   shpOff += 4
    shp.writeDoubleLE(rec.bbox[0], shpOff);          shpOff += 8  // Xmin
    shp.writeDoubleLE(rec.bbox[1], shpOff);          shpOff += 8  // Ymin
    shp.writeDoubleLE(rec.bbox[2], shpOff);          shpOff += 8  // Xmax
    shp.writeDoubleLE(rec.bbox[3], shpOff);          shpOff += 8  // Ymax
    shp.writeInt32LE(numParts, shpOff);              shpOff += 4
    shp.writeInt32LE(numPts, shpOff);                shpOff += 4

    // Parts array
    let ptIdx = 0
    for (const ring of rec.rings) {
      shp.writeInt32LE(ptIdx, shpOff);  shpOff += 4
      ptIdx += ring.length
    }

    // Points array
    for (const ring of rec.rings) {
      for (const [x, y] of ring) {
        shp.writeDoubleLE(x, shpOff);  shpOff += 8
        shp.writeDoubleLE(y, shpOff);  shpOff += 8
      }
    }
  }

  return { shp, shx }
}

// ── DBF builder ───────────────────────────────────────────────────────────────

function buildDbf(fields: DbfField[], rows: Record<string, unknown>[]): Buffer {
  const recordSize = 1 + fields.reduce((s, f) => s + f.length, 0)
  // 32-byte file header + 32 bytes per field descriptor + 0x0D terminator + 0x1A EOF
  const headerSize = 32 + fields.length * 32 + 1
  const totalSize  = headerSize + rows.length * recordSize + 1

  const buf = Buffer.alloc(totalSize, 0)
  let off   = 0

  const now = new Date()
  buf[off++] = 3                                            // dBASE III
  buf[off++] = now.getFullYear() - 1900
  buf[off++] = now.getMonth() + 1
  buf[off++] = now.getDate()
  buf.writeUInt32LE(rows.length, off);  off += 4
  buf.writeUInt16LE(headerSize, off);   off += 2
  buf.writeUInt16LE(recordSize, off);   off += 2
  off += 20  // reserved

  for (const f of fields) {
    const nameBuf = Buffer.alloc(11, 0)
    Buffer.from(f.name.substring(0, 10), 'ascii').copy(nameBuf)
    nameBuf.copy(buf, off);             off += 11
    buf[off++] = f.type.charCodeAt(0)
    off += 4                                               // reserved
    buf[off++] = f.length
    buf[off++] = f.decimals ?? 0
    off += 14                                              // reserved
  }
  buf[off++] = 0x0D  // header terminator

  for (const row of rows) {
    buf[off++] = 0x20  // deletion flag (space = active)
    for (const f of fields) {
      const val = row[f.name]
      let str: string
      if (val == null || val === '') {
        str = ' '.repeat(f.length)
      } else if (f.type === 'N') {
        const n = Number(val)
        str = isNaN(n)
          ? ' '.repeat(f.length)
          : f.decimals
            ? n.toFixed(f.decimals).padStart(f.length)
            : Math.round(n).toString().padStart(f.length)
        str = str.substring(0, f.length)
      } else {
        str = String(val).substring(0, f.length).padEnd(f.length)
      }
      Buffer.from(str, 'ascii').copy(buf, off)
      off += f.length
    }
  }
  buf[off] = 0x1A  // EOF
  return buf
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const guard = await requireModuleAccess('fsa-578')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  const { searchParams }  = new URL(request.url)
  const yearParam         = searchParams.get('year')
  const confirmedOnly     = searchParams.get('confirmed_only') !== 'false'
  const cropYear          = yearParam ? parseInt(yearParam, 10) : CURRENT_CROP_YEAR

  if (isNaN(cropYear)) {
    return NextResponse.json({ error: 'Invalid year' }, { status: 400 })
  }

  const { data: rows, error } = await supabase.rpc('export_clu_shapefile_rows', {
    p_crop_year:      cropYear,
    p_confirmed_only: confirmedOnly,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json(
      { error: `No ${confirmedOnly ? 'confirmed ' : ''}CLU records found for ${cropYear}` },
      { status: 404 }
    )
  }

  // ── Build shapefile records ──────────────────────────────────────────────────

  const shpRecords: ShpRecord[] = []
  const dbfRows: Record<string, unknown>[] = []

  for (const row of rows) {
    const rings = geojsonToRings(row.geojson ?? null)

    if (rings.length > 0) {
      shpRecords.push({ rings, bbox: ringBbox(rings) })
    } else {
      // Null geometry — still write a record (null shape type 0)
      shpRecords.push({ rings: [], bbox: [0, 0, 0, 0] })
    }

    dbfRows.push({
      FARM_NBR:   row.farm_number  ?? '',
      TRACT_NBR:  row.tract_number ?? '',
      CLU_NBR:    row.clu_number   ?? '',
      FIELD_NAME: row.field_name   ?? '',
      CROP:       row.crop         ?? '',
      USE:        row.intended_use ?? '',
      FSA_ACRES:  row.fsa_acres,
      CALC_ACRES: row.calc_acres,
      IRRIGATED:  row.irrigated   ? 'I' : 'N',
      ORGANIC:    row.organic     ? 'O' : 'C',
      COVER_CROP: row.cover_crop  ? 'Y' : 'N',
      PREV_PLANT: row.prevented_planting ? 'Y' : 'N',
      PLANT_DATE: row.grain_plant_date ?? '',
      STATUS:     row.reported    ? 'CONFIRMED' : 'PENDING',
      GLM_ZONE:   row.zone_id    ?? '',
      GLM_CROP:   row.zone_crop  ?? '',
      GLM_IRR:    row.zone_irrigated ? 'Y' : 'N',
      GLM_ORG:    row.zone_organic   ? 'Y' : 'N',
    })
  }

  // ── Define DBF schema ────────────────────────────────────────────────────────

  const DBF_FIELDS: DbfField[] = [
    { name: 'FARM_NBR',   type: 'C', length: 10 },
    { name: 'TRACT_NBR',  type: 'C', length: 10 },
    { name: 'CLU_NBR',    type: 'C', length: 20 },
    { name: 'FIELD_NAME', type: 'C', length: 30 },
    { name: 'CROP',       type: 'C', length: 30 },
    { name: 'USE',        type: 'C', length: 30 },
    { name: 'FSA_ACRES',  type: 'N', length: 10, decimals: 2 },
    { name: 'CALC_ACRES', type: 'N', length: 10, decimals: 2 },
    { name: 'IRRIGATED',  type: 'C', length: 1  },
    { name: 'ORGANIC',    type: 'C', length: 1  },
    { name: 'COVER_CROP', type: 'C', length: 1  },
    { name: 'PREV_PLANT', type: 'C', length: 1  },
    { name: 'PLANT_DATE', type: 'C', length: 10 },
    { name: 'STATUS',     type: 'C', length: 9  },
    { name: 'GLM_ZONE',   type: 'C', length: 36 },
    { name: 'GLM_CROP',   type: 'C', length: 30 },
    { name: 'GLM_IRR',    type: 'C', length: 1  },
    { name: 'GLM_ORG',    type: 'C', length: 1  },
  ]

  // ── Write binary ─────────────────────────────────────────────────────────────

  const { shp, shx } = buildShpAndShx(shpRecords)
  const dbf           = buildDbf(DBF_FIELDS, dbfRows)

  // ── Zip ───────────────────────────────────────────────────────────────────────

  const stem    = `clu-export-${cropYear}${confirmedOnly ? '-confirmed' : ''}`
  const zip     = new JSZip()
  zip.file(`${stem}.shp`, shp)
  zip.file(`${stem}.shx`, shx)
  zip.file(`${stem}.dbf`, dbf)
  zip.file(`${stem}.prj`, WGS84_PRJ)

  const zipBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })

  return new NextResponse(new Uint8Array(zipBuf), {
    status: 200,
    headers: {
      'Content-Type':        'application/zip',
      'Content-Disposition': `attachment; filename="${stem}.zip"`,
      'Cache-Control':       'no-store',
    },
  })
}
