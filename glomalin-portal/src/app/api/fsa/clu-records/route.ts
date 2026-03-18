import { NextResponse } from 'next/server'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'

export async function GET(request: Request) {
  const guard = await requireModuleAccess('fsa-578')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  // Parse year from query string, default to 2026
  const { searchParams } = new URL(request.url)
  const yearParam = searchParams.get('year')
  const year = yearParam ? parseInt(yearParam, 10) : 2026

  if (isNaN(year)) {
    return NextResponse.json({ error: 'Invalid year parameter' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('clu_records')
    .select('*')
    .eq('crop_year', year)
    .order('farm_number')
    .order('tract_number')
    .order('clu')

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch CLU records', details: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    records: data ?? [],
    count: data?.length ?? 0,
    year,
  })
}

const REQUIRED_FIELDS = ['farm_number', 'tract_number', 'clu', 'fsa_acres', 'crop_year'] as const

const ALLOWED_FIELDS = new Set([
  'farm_number',
  'tract_number',
  'clu',
  'field_name',
  'farm_name',
  'fsa_acres',
  'crop',
  'irrigated',
  'organic',
  'double_crop',
  'cover_crop',
  'grain_plant_date',
  'use',
  'reported',
  'crop_year',
  'prevented_planting',
])

export async function POST(request: Request) {
  const guard = await requireModuleAccess('fsa-578')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Validate required fields
  for (const field of REQUIRED_FIELDS) {
    if (body[field] == null || String(body[field]).trim() === '') {
      return NextResponse.json(
        { error: `${field} is required` },
        { status: 400 }
      )
    }
  }

  // Whitelist allowed fields
  const insert: Record<string, unknown> = {}
  for (const key of Object.keys(body)) {
    if (ALLOWED_FIELDS.has(key)) {
      insert[key] = body[key]
    }
  }

  // Defaults
  if (insert.irrigated == null) insert.irrigated = false
  if (insert.organic == null) insert.organic = false
  if (insert.double_crop == null) insert.double_crop = false
  if (insert.cover_crop == null) insert.cover_crop = false
  if (insert.reported == null) insert.reported = false
  if (insert.prevented_planting == null) insert.prevented_planting = false

  const { data, error } = await supabase
    .from('clu_records')
    .insert(insert)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ record: data }, { status: 201 })
}
