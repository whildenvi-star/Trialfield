import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()

  // Auth check — API route is under /api, not /app, so middleware does not enforce module access.
  // Auth check here is sufficient since only authenticated users call this endpoint.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse year from query string, default to 2026
  const { searchParams } = new URL(request.url)
  const yearParam = searchParams.get('year')
  const year = yearParam ? parseInt(yearParam, 10) : 2026

  if (isNaN(year)) {
    return NextResponse.json({ error: 'Invalid year parameter' }, { status: 400 })
  }

  // Optional farm_number and crop filters for CLU-to-Policy lookup (Phase 33)
  const farmNumber = searchParams.get('farm_number')
  const cropFilter = searchParams.get('crop')

  let query = supabase
    .from('insurance_policies')
    .select('*')
    .eq('policy_year', year)

  if (farmNumber) {
    query = query.eq('farm_number', farmNumber)
  }

  if (cropFilter) {
    // ilike for case-insensitive match — FSA crop names vs insurance crop names may differ in casing
    query = query.ilike('crop', cropFilter)
  }

  query = query.order('farm_name')

  const { data, error } = await query

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch insurance policies', details: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    policies: data ?? [],
    count: data?.length ?? 0,
    year,
  })
}

// POST /api/insurance/policies
// Creates a new insurance policy. INS-02: Policy CRUD.
export async function POST(request: Request) {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse request body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Validate required fields
  const plantedAcres = typeof body.planted_acres === 'number' ? body.planted_acres : null
  if (!plantedAcres || plantedAcres <= 0) {
    return NextResponse.json(
      { error: 'planted_acres is required and must be a positive number' },
      { status: 400 }
    )
  }

  // Build insert object with defaults for optional fields
  const insertData = {
    legacy_id: `ins_manual_${Date.now()}`,
    policy_year: typeof body.policy_year === 'number' ? body.policy_year : 2026,
    farm_name: typeof body.farm_name === 'string' ? body.farm_name : null,
    farm_number: typeof body.farm_number === 'string' ? body.farm_number : null,
    crop: typeof body.crop === 'string' ? body.crop : null,
    planted_acres: plantedAcres,
    fsa_acres_manual: typeof body.fsa_acres_manual === 'number' ? body.fsa_acres_manual : null,
    guarantee: typeof body.guarantee === 'number' ? body.guarantee : 0,
    actual: typeof body.actual === 'number' ? body.actual : 0,
    coverage_level: typeof body.coverage_level === 'number' ? body.coverage_level : 75,
    unit_type: typeof body.unit_type === 'string' ? body.unit_type : null,
    premium_per_acre: typeof body.premium_per_acre === 'number' ? body.premium_per_acre : null,
    plan_type: typeof body.plan_type === 'string' ? body.plan_type : null,
    agent_name: typeof body.agent_name === 'string' ? body.agent_name : null,
    notes: typeof body.notes === 'string' ? body.notes : null,
    prevented_planting: typeof body.prevented_planting === 'boolean' ? body.prevented_planting : false,
    prevented_planting_acres:
      typeof body.prevented_planting_acres === 'number' ? body.prevented_planting_acres : null,
    // Phase 29 defaults
    claim_alert: 'none',
    actual_synced_from_grain: false,
  }

  const { data: policy, error } = await supabase
    .from('insurance_policies')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: 'Failed to create policy', details: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ policy }, { status: 201 })
}
