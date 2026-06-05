import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FieldMap } from '@/components/maps/field-map'

export default async function MapsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="fixed top-0 bottom-0 right-0 left-0 md:left-[220px]">
      <Suspense fallback={<div className="w-full h-full bg-[#080604] animate-pulse" />}>
        <FieldMap isAdmin={isAdmin} />
      </Suspense>
    </div>
  )
}
