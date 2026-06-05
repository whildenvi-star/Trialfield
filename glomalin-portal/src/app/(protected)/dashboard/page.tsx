import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { MODULES } from '@/lib/modules'
import { DashboardGrid } from '@/components/dashboard/DashboardGrid'
import { FieldMap } from '@/components/maps/field-map'

// Preserve FieldMap for desktop; render mobile card grid on small screens
export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: accessRows }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('module_access').select('module, granted').eq('user_id', user.id),
  ])

  const role = profile?.role ?? 'viewer'
  const grantedModuleIds: string[] = role === 'admin'
    ? MODULES.map((m) => m.id)
    : (accessRows ?? []).filter((r) => r.granted).map((r) => r.module as string)

  return (
    <>
      {/* Mobile: card grid */}
      <div className="md:hidden overflow-y-auto h-full">
        <DashboardGrid role={role} grantedModuleIds={grantedModuleIds} />
      </div>
      {/* Desktop: existing FieldMap */}
      <div className="hidden md:block h-full">
        <div className="fixed inset-0 md:left-[220px]">
          <Suspense fallback={<div className="w-full h-full bg-[#080604] animate-pulse" />}>
            <FieldMap isAdmin={role === 'admin'} />
          </Suspense>
        </div>
      </div>
    </>
  )
}
