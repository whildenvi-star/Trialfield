import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BannerSection from '@/components/layout/banner-section'
import DeniedToast from '@/components/denied-toast'

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
      <BannerSection
        user={{
          email: user.email ?? '',
          fullName: profile?.full_name ?? null,
          role: profile?.role ?? 'viewer',
        }}
      />
      <Suspense fallback={null}>
        <DeniedToast />
      </Suspense>
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
