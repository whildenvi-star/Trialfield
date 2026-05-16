// FieldView DAT file parser
//
// FieldView exports a ZIP archive where:
//   FarmName / SerialNumber / field_map_YYYY_MM_DD_NNN.dat            → planting map (INI text header + binary [Data])
//   FarmName / SerialNumber / liquid_map_YYYY_MM_DD_NNN.dat           → liquid application (binary)
//   FarmName / SerialNumber / equipment_coverage_map_YYYY_MM_DD_NNN.dat → equipment coverage (binary)
//   FarmName / SerialNumber / harvest_YYYY_MM_DD_NNN.dat              → harvest (binary)
//
// Only field_map files have a readable INI text header. All others are binary protobuf-like.
// For binary files we extract metadata from the filename and ZIP folder path only — we never
// spread binary content into raw_payload because null bytes break PostgreSQL jsonb.
//
// Multiple DAT files represent the same pass split into segments.
// groupDatEvents collapses them by (field_name, op_date, op_type, product).

import type { NormalizedCoverageEvent } from '@/lib/fsa/adapters/fieldview'

export const ADAPTER_FIELDVIEW_DAT = 'fieldview-dat'

function inferOpType(filename: string): string {
  const f = filename.toLowerCase()
  if (f.startsWith('field_map'))   return 'planting'
  if (f.startsWith('liquid_map'))  return 'application'
  if (f.startsWith('harvest'))     return 'harvest'
  if (f.startsWith('tillage'))     return 'tillage'
  return 'application'
}

// Text-header DAT files start with "[Field Map Data]" and have a readable INI section
// before a binary [Data] block. Binary-only files (liquid_map, equipment_coverage_map,
// etc.) don't have this — spreading their content into raw_payload would inject null
// bytes that PostgreSQL jsonb rejects.
function hasTextHeader(content: string): boolean {
  return content.trimStart().startsWith('[')
}

function extractDate(filename: string): string | null {
  const m = filename.match(/_(\d{4})_(\d{2})_(\d{2})_\d+\.dat$/i)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

// Parse the readable INI portion of a DAT file (everything before [Data])
function parseIni(content: string): Record<string, string> {
  const dataIdx = content.indexOf('\n[Data]')
  const text = dataIdx >= 0 ? content.slice(0, dataIdx) : content
  const result: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    const val = line.slice(eq + 1).trim()
    if (key && !key.startsWith('[')) result[key] = val
  }
  return result
}

export interface ParsedDatEvent extends NormalizedCoverageEvent {
  _fieldName: string | null
}

export function parseDatFile(
  content: string,
  zipPath: string,
  cropYear: number,
): ParsedDatEvent {
  const parts    = zipPath.replace(/\\/g, '/').split('/')
  const filename = parts[parts.length - 1] ?? ''
  // Top-level folder in the ZIP is the farm/field name FieldView assigned
  const folderName = parts.length >= 3 ? parts[0] : null

  const readable  = hasTextHeader(content)
  const ini       = readable ? parseIni(content) : {}
  const fieldName = ini['field_name'] || folderName || null
  const crop      = ini['crop_name'] || null
  const hybrid    = ini['seed_hybrid_name_1'] || null
  const acresRaw  = parseFloat(ini['field_size'] ?? '')
  const acres     = isFinite(acresRaw) && acresRaw > 0 ? acresRaw : null
  const opType    = inferOpType(filename)
  const product   = opType === 'planting'
    ? hybrid
    : (ini['product_1_name'] ?? ini['application_product_name'] ?? null)

  // For binary files: only safe scalar metadata — never binary bytes in jsonb
  const safeIni = readable
    ? Object.fromEntries(
        Object.entries(ini).filter(([, v]) => typeof v === 'string' && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v))
      )
    : {}

  return {
    crop_year:      cropYear,
    source_adapter: ADAPTER_FIELDVIEW_DAT,
    operation_type: opType,
    op_date:        extractDate(filename),
    geojson:        null,
    applied_acres:  acres,
    product,
    rate:           null,
    rate_unit:      null,
    raw_payload: {
      zip_path:   zipPath,
      field_name: fieldName,
      crop,
      readable_header: readable,
      ...safeIni,
    },
    _fieldName: fieldName,
  }
}

// Group and deduplicate events from the same session (multiple DAT segments)
export function groupDatEvents(events: ParsedDatEvent[]): NormalizedCoverageEvent[] {
  const groups = new Map<string, ParsedDatEvent[]>()
  for (const e of events) {
    const key = [e._fieldName ?? '', e.op_date ?? '', e.operation_type, e.product ?? ''].join('|')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(e)
  }

  return Array.from(groups.values()).map((group) => {
    const base        = group[0]
    const totalAcres  = group.reduce((s, e) => s + (e.applied_acres ?? 0), 0)
    const sourceFiles = group.map((e) => (e.raw_payload as Record<string, unknown>)['zip_path'])
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _fieldName, ...baseEvent } = base
    return {
      ...baseEvent,
      applied_acres: totalAcres > 0 ? totalAcres : null,
      raw_payload: {
        ...base.raw_payload,
        source_file_count: group.length,
        source_files:      sourceFiles,
      },
    } satisfies NormalizedCoverageEvent
  })
}
