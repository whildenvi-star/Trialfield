import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/header'
import DeniedToast from '@/components/denied-toast'
import ASCIIBannerStrip from '@/components/layout/ASCIIBannerStrip'

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-soil-bg">
      <Header
        user={{
          email: user.email ?? '',
          fullName: profile?.full_name ?? null,
          role: profile?.role ?? 'viewer',
        }}
      />
      {/* 72px desktop / 48px mobile */}
      <div className="hidden md:block">
        <ASCIIBannerStrip height={72} />
      </div>
      <div className="block md:hidden">
        <ASCIIBannerStrip height={48} nodeCount={6} />
      </div>
      <Suspense fallback={null}>
        <DeniedToast />
      </Suspense>
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
