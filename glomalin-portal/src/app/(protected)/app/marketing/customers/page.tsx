import { redirect } from 'next/navigation'
import { getMarketingAuthContext } from '@/lib/supabase/marketing-guard-rsc'
import { fetchCertServiceWithAuth } from '@/app/api/mobile/_lib/proxy'
import { CustomerListClient } from '@/components/marketing/customer-list'

export default async function CustomersPage() {
  const ctx = await getMarketingAuthContext()
  if (!ctx) redirect('/app')

  const { role, accessToken } = ctx

  const res = await fetchCertServiceWithAuth('/api/marketing/customers', accessToken)
  const customers = res.ok ? await res.json() : []

  return <CustomerListClient customers={customers} role={role} />
}
