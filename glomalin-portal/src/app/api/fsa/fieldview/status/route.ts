import { NextResponse } from 'next/server'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'
import { isFieldViewConfigured } from '@/lib/fsa/adapters/fieldview'

// GET /api/fsa/fieldview/status
// Returns the current user's FieldView connection state.
export async function GET() {
  const guard = await requireModuleAccess('fsa-578')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  const { data } = await supabase
    .from('fieldview_tokens')
    .select('expires_at, scope, connected_at')
    .eq('user_id', guard.user.id)
    .maybeSingle()

  return NextResponse.json({
    fieldview_configured: isFieldViewConfigured(),
    connected:            !!data,
    expires_at:           data?.expires_at ?? null,
    connected_at:         data?.connected_at ?? null,
    scope:                data?.scope ?? null,
  })
}
