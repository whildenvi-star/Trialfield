import { redirect } from 'next/navigation'
import { getMarketingAuthContext } from '@/lib/supabase/marketing-guard-rsc'
import { fetchCertServiceWithAuth } from '@/app/api/mobile/_lib/proxy'
// DeliveryListClient created in Wave 3 (14-03)
import { DeliveryListClient } from '@/components/marketing/delivery-list'

export default async function DeliveriesPage() {
  const ctx = await getMarketingAuthContext()
  if (!ctx) redirect('/app')

  const { role, accessToken } = ctx

  const [deliveriesRes, contractsRes] = await Promise.all([
    fetchCertServiceWithAuth('/api/marketing/deliveries', accessToken),
    fetchCertServiceWithAuth('/api/marketing/contracts', accessToken),
  ])

  if (!deliveriesRes.ok) {
    throw new Error(`Failed to load deliveries: ${deliveriesRes.status}`)
  }
  if (!contractsRes.ok) {
    throw new Error(`Failed to load contracts: ${contractsRes.status}`)
  }

  const deliveries = await deliveriesRes.json()
  const contracts = await contractsRes.json()

  return <DeliveryListClient deliveries={deliveries} contracts={contracts} role={role} />
}
