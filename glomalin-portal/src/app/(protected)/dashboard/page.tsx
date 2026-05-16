import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { FieldMap } from '@/components/maps/field-map'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="fixed inset-0 md:left-[220px]">
      <Suspense fallback={<div className="w-full h-full bg-[#080604] animate-pulse" />}>
        <FieldMap />
      </Suspense>
    </div>
  )
}
