import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { computeClaimAlert } from '@/lib/insurance/calc'

// POST /api/insurance/yield-push
// Server-to-server push from grain-tickets — receives bulk yield summaries and updates
// matching insurance_policies by registry_field_id + registry_crop_id.
// PIPE-02: Yield push pipeline receiving endpoint.
//
// No user auth guard — this is a machine-to-machine push authenticated by ecosystem token.
// Uses service_role key to bypass RLS for writes.

interface YieldSummary {
  registryFieldId: string
  registryCropId: string
  farmName: string
  cropName: string
  totalNetLbs: number
  totalNetBU: number
  yieldPerAcre: number
  acres: number
  ticketCount: number
}

interface PushBody {
  summaries: YieldSummary[]
  cropYear: number
}

export async function POST(request: Request) {
  // Ecosystem token gate — server-to-server only, no user session
  const token = request.headers.get('x-ecosystem-token')
  const expected = process.env.EMBED_TOKEN
  if (!expected || token !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
  let body: PushBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { summaries, cropYear } = body
  if (!Array.isArray(summaries) || !cropYear) {
    return NextResponse.json({ error: 'summaries array and cropYear are required' }, { status: 400 })
  }

  // Use service_role client to bypass RLS — yield push writes actuals to insurance_policies
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  let matched = 0
  let skipped = 0
  const errors: string[] = []

  for (const summary of summaries) {
    const { registryFieldId, registryCropId, totalNetBU } = summary

    if (!registryFieldId || !registryCropId) {
      skipped++
      continue
    }

    try {
      // Find matching insurance policy by registry IDs + policy year
      const { data: policies, error: queryError } = await supabase
        .from('insurance_policies')
        .select('id, guarantee, coverage_level, planted_acres')
        .eq('registry_field_id', registryFieldId)
        .eq('registry_crop_id', registryCropId)
        .eq('policy_year', cropYear)

      if (queryError) {
        errors.push(`Query error for field ${registryFieldId}: ${queryError.message}`)
        continue
      }

      if (!policies || policies.length === 0) {
        // No matching insurance policy — skip (no insurance for this field/crop)
        skipped++
        continue
      }

      // Update each matched policy — use insurance planted_acres as denominator (not grain-tickets acres)
      for (const policy of policies) {
        const plantedAcres = policy.planted_acres ?? 0
        // Use planted_acres from insurance policy as the denominator per user decision
        const yieldPerAcre = plantedAcres > 0 ? totalNetBU / plantedAcres : 0

        // Recompute claim alert with updated actual yield
        const claimAlert = computeClaimAlert({
          guarantee: policy.guarantee ?? 0,
          actual: yieldPerAcre,
          coverage_level: policy.coverage_level ?? 75,
        })

        const { error: updateError } = await supabase
          .from('insurance_policies')
          .update({
            actual: yieldPerAcre,
            actual_synced_from_grain: true,
            yield_synced_at: new Date().toISOString(),
            claim_alert: claimAlert,
          })
          .eq('id', policy.id)

        if (updateError) {
          errors.push(`Update error for policy ${policy.id}: ${updateError.message}`)
        } else {
          matched++
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`Unexpected error for field ${registryFieldId}: ${msg}`)
    }
  }

  return NextResponse.json({ ok: true, matched, skipped, errors })
}
