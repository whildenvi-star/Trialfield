import { NextResponse } from 'next/server'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'
import { normName, computeAphFromClus } from '@/lib/insurance/calc'
import { CURRENT_CROP_YEAR } from '@/lib/config'

// GET /api/insurance/aph-lookup?crop=Corn&farmName=KLUG%20FARMS
// Returns APH average computed from matching CLU records.
// INS-05: APH auto-detection from CLU records.
export async function GET(request: Request) {
  const guard = await requireModuleAccess('insurance')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  // Parse query params
  const { searchParams } = new URL(request.url)
  const crop = searchParams.get('crop') ?? ''
  const farmName = searchParams.get('farmName') ?? ''

  if (!crop) {
    return NextResponse.json({ error: 'crop query parameter is required' }, { status: 400 })
  }

  // Query CLU records filtered by crop (case-insensitive) and current year
  const { data, error } = await supabase
    .from('clu_records')
    .select('farm_name, farm_number, aph, fsa_acres')
    .ilike('crop', `%${crop}%`)
    .eq('crop_year', CURRENT_CROP_YEAR)

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch CLU records', details: error.message },
      { status: 500 }
    )
  }

  const records = data ?? []

  // Further filter by farm name — substring containment in either direction
  // Allows "KLUG, DAVIS" to match "klug" and vice versa
  let filtered = records
  if (farmName) {
    const normPolicyFarm = normName(farmName)
    filtered = records.filter((r) => {
      const normCluFarm = normName(r.farm_name)
      return (
        normPolicyFarm.length > 0 &&
        normCluFarm.length > 0 &&
        (normPolicyFarm.includes(normCluFarm) || normCluFarm.includes(normPolicyFarm))
      )
    })
  }

  // Compute APH from filtered CLU records
  const { avgAph, count, totalRecords } = computeAphFromClus(filtered)

  // When count=0 but totalRecords>0 → CLUs found but no APH values entered
  // When totalRecords=0 → No matching CLU records found
  // Phase 30 UI interprets these signals to show the correct message

  return NextResponse.json({
    avgAph,
    count,
    totalRecords,
    farmName,
    crop,
  })
}
