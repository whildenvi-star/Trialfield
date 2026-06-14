import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface AuditEntry {
  id: string
  table: string
  label: string
  timestamp: string
  detail: string
}

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: callerProfile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !callerProfile || callerProfile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [cluRes, policyRes, aphRes, claimsRes, timelineRes] = await Promise.all([
    supabase
      .from('clu_records')
      .select('id, crop_year, farm_number, tract, clu_number, reported, updated_at')
      .order('updated_at', { ascending: false })
      .limit(20),
    supabase
      .from('insurance_policies')
      .select('id, crop, policy_year, farm_name, claim_alert, updated_at')
      .order('updated_at', { ascending: false })
      .limit(20),
    supabase
      .from('aph_records')
      .select('id, crop_year, actual_yield, updated_at, insurance_policies(crop)')
      .order('updated_at', { ascending: false })
      .limit(20),
    supabase
      .from('claims')
      .select('id, stage, crop, farm_name, date_of_loss, updated_at')
      .order('updated_at', { ascending: false })
      .limit(20),
    supabase
      .from('claim_timeline')
      .select('id, claim_id, event_type, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const entries: AuditEntry[] = []

  for (const row of cluRes.data ?? []) {
    entries.push({
      id: `clu-${row.id}`,
      table: 'clu',
      label: `CLU ${row.farm_number}/${row.tract}/${row.clu_number} (${row.crop_year})`,
      timestamp: row.updated_at,
      detail: row.reported ? 'Reported' : 'Not reported',
    })
  }

  for (const row of policyRes.data ?? []) {
    entries.push({
      id: `policy-${row.id}`,
      table: 'insurance',
      label: `Policy: ${row.farm_name} — ${row.crop} (${row.policy_year})`,
      timestamp: row.updated_at,
      detail: `claim_alert: ${row.claim_alert}`,
    })
  }

  for (const row of aphRes.data ?? []) {
    const policy = row.insurance_policies as unknown as { crop: string } | null
    const crop = policy?.crop ?? 'unknown'
    entries.push({
      id: `aph-${row.id}`,
      table: 'aph',
      label: `APH: ${crop} ${row.crop_year}`,
      timestamp: row.updated_at,
      detail: `${row.actual_yield} bu/ac`,
    })
  }

  for (const row of claimsRes.data ?? []) {
    entries.push({
      id: `claim-${row.id}`,
      table: 'claim',
      label: `Claim: ${row.farm_name} — ${row.crop ?? 'crop'}`,
      timestamp: row.updated_at,
      detail: `Stage: ${row.stage}`,
    })
  }

  for (const row of timelineRes.data ?? []) {
    entries.push({
      id: `event-${row.id}`,
      table: 'event',
      label: `Claim event: ${row.event_type}`,
      timestamp: row.created_at,
      detail: `claim ${String(row.claim_id).slice(0, 8)}`,
    })
  }

  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return NextResponse.json({ entries })
}
