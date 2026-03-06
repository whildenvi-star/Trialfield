import { createClient } from '@/lib/supabase/server'
import { ClaimsWorkspace } from '@/components/claims/claims-workspace'

/**
 * Claims page — server component.
 * Fetches all claims from Supabase and hands off to the client workspace.
 * ClaimsWorkspace owns all interactive state; this server component only handles
 * the initial data fetch and the static page shell.
 *
 * Pattern: mirrors InsuranceWorkspace handoff from Phase 30.
 */
export default async function ClaimsPage() {
  const supabase = await createClient()

  const { data: claimsData } = await supabase
    .from('claims')
    .select('*')
    .order('created_at', { ascending: false })

  return <ClaimsWorkspace initialClaims={claimsData ?? []} />
}
