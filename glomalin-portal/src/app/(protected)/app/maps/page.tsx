import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FieldMap } from '@/components/maps/field-map'

export default async function MapsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: accessRows }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('module_access').select('module, granted').eq('user_id', user.id),
  ])

  const isAdmin = profile?.role === 'admin'
  // null = admin, sees every module in the canvas rail's Modules drawer.
  const grantedModules = isAdmin
    ? null
    : (accessRows ?? []).filter((r) => r.granted).map((r) => r.module as string)

  return (
    // Full-bleed: the canvas is the shell here, so it is not inset by the
    // global sidebar (SideNav stands down on this route and zeroes --sidebar-w).
    <div className="fixed inset-0 bg-glomalin-canvas-bg">
      <Suspense fallback={<div className="w-full h-full bg-glomalin-canvas-bg animate-pulse" />}>
        <FieldMap isAdmin={isAdmin} grantedModules={grantedModules} />
      </Suspense>
    </div>
  )
}
