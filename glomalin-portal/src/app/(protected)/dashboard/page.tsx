import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MODULES } from '@/lib/modules'
import { DashboardGrid } from '@/components/dashboard/DashboardGrid'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: accessRows }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('module_access').select('module, granted').eq('user_id', user.id),
  ])

  const role = profile?.role ?? 'viewer'

  const grantedModules: string[] | null = role === 'admin'
    ? null
    : (accessRows ?? []).filter((r) => r.granted).map((r) => r.module as string)

  // Office (Sandy) homes on MACRO, same as admins.
  if (user.app_metadata?.app_role === 'office') redirect('/app/farm-budget')

  // Only send operators to the crew app if they hold the module grant —
  // otherwise middleware bounces /app/crew back here and the client loops.
  if (role === 'operator' && grantedModules?.includes('crew')) redirect('/app/crew')

  const grantedModuleIds: string[] = grantedModules === null
    ? MODULES.map((m) => m.id)
    : grantedModules

  // Card grid at every size — the map dashboard was demoted to the
  // Field Map module (/app/maps), same FieldMap component.
  return (
    <div className="overflow-y-auto h-full">
      <DashboardGrid role={role} grantedModuleIds={grantedModuleIds} />
    </div>
  )
}
