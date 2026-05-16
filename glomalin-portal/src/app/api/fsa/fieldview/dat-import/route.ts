// POST /api/fsa/fieldview/dat-import
//
// Accepts a FieldView manual export ZIP file (multipart/form-data).
// Extracts all .dat files, parses the INI text headers, groups segments
// from the same session, and imports as coverage_events records.
//
// Form fields:
//   file      — the .zip file
//   crop_year — optional integer (defaults to CURRENT_CROP_YEAR)
//
// Returns the same shape as /api/fsa/coverage-import:
//   { imported, zone_matched, unmatched, skipped, warnings, errors, events_preview }

import { NextResponse } from 'next/server'
import JSZip           from 'jszip'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'
import { CURRENT_CROP_YEAR } from '@/lib/config'
import { parseDatFile, groupDatEvents } from '@/lib/fsa/parsers/fieldview-dat'

export const runtime = 'nodejs'  // JSZip requires Node runtime

export async function POST(request: Request) {
  const guard = await requireModuleAccess('fsa-578')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  // Parse multipart form
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }

  const file      = formData.get('file')
  const yearParam = formData.get('crop_year')
  const cropYear  = yearParam ? parseInt(String(yearParam), 10) : CURRENT_CROP_YEAR

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  // Open ZIP
  let zip: JSZip
  try {
    const buffer = await file.arrayBuffer()
    zip = await JSZip.loadAsync(buffer)
  } catch {
    return NextResponse.json({ error: 'Could not read ZIP file' }, { status: 400 })
  }

  // Extract .dat files (skip macOS metadata folders)
  const datFiles: Array<{ zipPath: string; content: string }> = []
  const warnings: string[] = []

  await Promise.all(
    Object.entries(zip.files).map(async ([zipPath, entry]) => {
      if (entry.dir) return
      if (zipPath.startsWith('__MACOSX/')) return
      const filename = zipPath.split('/').pop()?.toLowerCase() ?? ''
      if (!filename.endsWith('.dat')) return
      if (!filename.startsWith('field_map')) return  // FSA only needs planting maps
      try {
        const content = await entry.async('string')
        datFiles.push({ zipPath, content })
      } catch {
        warnings.push(`Could not read ${zipPath}`)
      }
    })
  )

  if (datFiles.length === 0) {
    return NextResponse.json(
      { error: 'No planting (field_map_*.dat) files found in ZIP. Export the planting layer from FieldView and try again.' },
      { status: 400 }
    )
  }

  // Parse and group
  const parsed  = datFiles.map(({ zipPath, content }) => parseDatFile(content, zipPath, cropYear))
  const events  = groupDatEvents(parsed)

  // Insert each event
  let imported    = 0
  let unmatched   = 0
  let skipped     = 0
  const errors: string[] = []
  const eventsPreview: Array<{ field: string | null; op_type: string; date: string | null; product: string | null; files: number }> = []

  for (const event of events) {
    if (!event.crop_year || !event.source_adapter || !event.operation_type) {
      skipped++
      continue
    }

    const raw = event.raw_payload as Record<string, unknown>
    eventsPreview.push({
      field:    raw['field_name'] as string | null,
      op_type:  event.operation_type,
      date:     event.op_date ?? null,
      product:  event.product ?? null,
      files:    (raw['source_file_count'] as number | undefined) ?? 1,
    })

    // No geometry → zone_id stays null, counts as unmatched
    unmatched++

    const { error: insertErr } = await supabase.rpc('import_coverage_event', {
      p_zone_id:        null,
      p_crop_year:      event.crop_year,
      p_source_adapter: event.source_adapter,
      p_operation_type: event.operation_type,
      p_op_date:        event.op_date ?? '',
      p_geojson:        '',
      p_applied_acres:  event.applied_acres ?? null,
      p_product:        event.product ?? null,
      p_rate:           event.rate ?? null,
      p_rate_unit:      event.rate_unit ?? null,
      p_raw_payload:    event.raw_payload ?? {},
    })

    if (insertErr) {
      errors.push(`Insert failed for ${raw['field_name'] ?? 'unknown'}: ${insertErr.message}`)
    } else {
      imported++
    }
  }

  return NextResponse.json({
    source:         'fieldview-dat',
    crop_year:      cropYear,
    dat_files_found: datFiles.length,
    imported,
    zone_matched:   0,
    unmatched,
    skipped,
    warnings,
    errors:         errors.slice(0, 20),
    events_preview: eventsPreview,
  })
}
