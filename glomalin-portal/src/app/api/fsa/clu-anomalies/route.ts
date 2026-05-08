import { NextResponse } from 'next/server'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'
import { CURRENT_CROP_YEAR } from '@/lib/config'

export interface CluAnomalyResult {
  clu_record_id: string
  farm_number: string
  tract_number: string
  clu_label: string
  field_name: string | null
  fsa_acres: number
  zone_count: number
  zone_names: string[]
  zone_crops: string[]
  zone_organics: boolean[]
  intersection_acs: number[]
}

export async function GET(request: Request) {
  const guard = await requireModuleAccess('fsa-578')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  const year = new URL(request.url).searchParams.get('year')
  const cropYear = year ? parseInt(year, 10) : CURRENT_CROP_YEAR
  if (isNaN(cropYear)) {
    return NextResponse.json({ error: 'Invalid year parameter' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('detect_clu_split_candidates', {
    p_crop_year: cropYear,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ anomalies: data ?? [] })
}
