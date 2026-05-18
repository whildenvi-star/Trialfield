import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MODULES } from '@/lib/modules'
import SideNav from '@/components/layout/side-nav'
import DeniedToast from '@/components/denied-toast'
import { MobileHeader } from '@/components/layout/mobile-header'
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav'
import { SyncStatusProvider } from '@/components/pwa/sync-status-provider'
import { ConflictDrawer } from '@/components/offline/conflict-drawer'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Middleware should catch unauthenticated requests, but be defensive
  if (!user) {
    redirect('/login')
  }

  const [{ data: profile }, { data: accessRows }] = await Promise.all([
    supabase.from('profiles').select('full_name, role').eq('id', user.id).single(),
    supabase.from('module_access').select('module, granted').eq('user_id', user.id),
  ])

  const role = profile?.role ?? 'viewer'
  // Admins see all modules; everyone else sees only explicitly granted ones.
  const grantedModules = role === 'admin'
    ? null // null = show all
    : (accessRows ?? []).filter((r) => r.granted).map((r) => r.module as string)

  // MobileBottomNav needs a flat string[] — null means admin (all modules granted)
  const grantedModuleIds = grantedModules === null
    ? MODULES.map((m) => m.id)
    : grantedModules

  return (
    <div className="min-h-screen bg-glomalin-bg">
      {/* Desktop: SideNav — hidden on mobile */}
      <div className="hidden md:block">
        <SideNav
          user={{
            email: user.email ?? '',
            fullName: profile?.full_name ?? null,
            role,
          }}
          grantedModules={grantedModules}
        />
      </div>

      {/* Mobile: Header + sync banner — visible on mobile only */}
      <div className="md:hidden">
        <MobileHeader pageTitle="Portal" />
        <SyncStatusProvider />
        <ConflictDrawer />
      </div>

      {/* Content area: offset on desktop, bottom-padded on mobile */}
      <div className="md:ml-[220px] pb-[56px] md:pb-0">
        <Suspense fallback={null}>
          <DeniedToast />
        </Suspense>
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </div>

      {/* Mobile: BottomNav — visible on mobile only */}
      <div className="md:hidden">
        <MobileBottomNav grantedModuleIds={grantedModuleIds} />
      </div>
    </div>
  )
}
