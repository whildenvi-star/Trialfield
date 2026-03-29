import { NextResponse } from 'next/server'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'
import { CURRENT_CROP_YEAR } from '@/lib/config'
import type { ContractType } from '@/lib/marketing/types'

const VALID_CONTRACT_TYPES: ContractType[] = [
  'cash',
  'accumulator',
  'hta',
  'options',
  'min-price',
  'basis',
]

// GET /api/marketing/contracts
// Returns all grain contracts for a given crop year (default CURRENT_CROP_YEAR).
// MKT-01: Contract CRUD — list contracts ordered by crop then created_at.
export async function GET(request: Request) {
  const guard = await requireModuleAccess('marketing')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  const { searchParams } = new URL(request.url)
  const yearParam = searchParams.get('year')
  const year = yearParam ? parseInt(yearParam, 10) : CURRENT_CROP_YEAR

  if (isNaN(year)) {
    return NextResponse.json({ error: 'Invalid year parameter' }, { status: 400 })
  }

  const cropFilter = searchParams.get('crop')

  let query = supabase
    .from('grain_contracts')
    .select('*')
    .eq('crop_year', year)
    .order('crop')
    .order('created_at')

  if (cropFilter) {
    query = query.ilike('crop', cropFilter)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch grain contracts', details: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    contracts: data ?? [],
    count: data?.length ?? 0,
    year,
  })
}

// POST /api/marketing/contracts
// Creates a new grain contract.
// MKT-01: Supports all six contract types: cash, accumulator, hta, options, min-price, basis.
export async function POST(request: Request) {
  const guard = await requireModuleAccess('marketing')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Validate required fields
  const crop = typeof body.crop === 'string' ? body.crop.trim() : null
  if (!crop) {
    return NextResponse.json({ error: 'crop is required' }, { status: 400 })
  }

  const contractType = body.contract_type as ContractType
  if (!contractType || !VALID_CONTRACT_TYPES.includes(contractType)) {
    return NextResponse.json(
      {
        error: `contract_type must be one of: ${VALID_CONTRACT_TYPES.join(', ')}`,
      },
      { status: 400 }
    )
  }

  const bushels = typeof body.bushels === 'number' ? body.bushels : null
  if (!bushels || bushels <= 0) {
    return NextResponse.json(
      { error: 'bushels is required and must be a positive number' },
      { status: 400 }
    )
  }

  const cropYear =
    typeof body.crop_year === 'number' ? body.crop_year : CURRENT_CROP_YEAR

  const insertData = {
    crop,
    registry_crop_id: typeof body.registry_crop_id === 'string' ? body.registry_crop_id : null,
    contract_type: contractType,
    bushels,
    price_per_bushel:
      typeof body.price_per_bushel === 'number' ? body.price_per_bushel : null,
    basis: typeof body.basis === 'number' ? body.basis : null,
    futures_reference:
      typeof body.futures_reference === 'number' ? body.futures_reference : null,
    buyer: typeof body.buyer === 'string' ? body.buyer.trim() || null : null,
    delivery_start:
      typeof body.delivery_start === 'string' ? body.delivery_start : null,
    delivery_end:
      typeof body.delivery_end === 'string' ? body.delivery_end : null,
    crop_year: cropYear,
    notes: typeof body.notes === 'string' ? body.notes : null,
  }

  const { data: contract, error } = await supabase
    .from('grain_contracts')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: 'Failed to create grain contract', details: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ contract }, { status: 201 })
}
