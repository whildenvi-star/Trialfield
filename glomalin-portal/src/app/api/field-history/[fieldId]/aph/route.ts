import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fieldId: string }> }
) {
  const { fieldId } = await params
  const supabase = await createClient()

  const { data: boundary } = await supabase
    .from('field_boundaries')
    .select('name, fsa_farm_number')
    .eq('registry_field_id', fieldId)
    .maybeSingle()

  const fieldName = boundary?.name ?? null

  if (!fieldName) {
    return NextResponse.json({ records: [] })
  }

  const { data: policies } = await supabase
    .from('insurance_policies')
    .select('id, crop, policy_year, farm_name')
    .ilike('farm_name', fieldName)

  if (!policies || policies.length === 0) {
    return NextResponse.json({ records: [] })
  }

  const policyIds = policies.map((p: { id: string }) => p.id)
  const policyMap: Record<string, string> = Object.fromEntries(
    policies.map((p: { id: string; crop: string }) => [p.id, p.crop])
  )

  const { data: aphRows } = await supabase
    .from('aph_records')
    .select('policy_id, crop_year, actual_yield, is_disaster_year, source')
    .in('policy_id', policyIds)

  if (!aphRows || aphRows.length === 0) {
    return NextResponse.json({ records: [] })
  }

  const records = aphRows.map((row: {
    policy_id: string
    crop_year: number
    actual_yield: number
    is_disaster_year: boolean
  }) => ({
    crop: policyMap[row.policy_id] ?? '',
    crop_year: row.crop_year,
    actual_yield: row.actual_yield,
    is_disaster_year: row.is_disaster_year,
  }))

  return NextResponse.json({ records })
}
