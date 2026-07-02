import { redirect } from 'next/navigation'
import { getMarketingAuthContext } from '@/lib/supabase/marketing-guard-rsc'
import { fetchCertServiceWithAuth } from '@/app/api/mobile/_lib/proxy'
import { ApplyDeliveryClient } from '@/components/marketing/delivery-apply'

export default async function DeliveryApplyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const ctx = await getMarketingAuthContext()
  if (!ctx) redirect('/app')

  const { accessToken } = ctx
  const { id } = await params

  const [deliveryRes, suggestionsRes] = await Promise.all([
    fetchCertServiceWithAuth('/api/marketing/deliveries/' + id, accessToken),
    fetchCertServiceWithAuth(
      '/api/marketing/deliveries/' + id + '/suggestions',
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      }
    ),
  ])

  if (!deliveryRes.ok) {
    throw new Error('Delivery not found')
  }

  const delivery = await deliveryRes.json()
  const suggestions = suggestionsRes.ok ? await suggestionsRes.json() : []

  return <ApplyDeliveryClient delivery={delivery} suggestions={suggestions} />
}
