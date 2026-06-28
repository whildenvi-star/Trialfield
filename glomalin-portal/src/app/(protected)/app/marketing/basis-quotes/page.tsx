import { redirect } from 'next/navigation'
import { getMarketingAuthContext } from '@/lib/supabase/marketing-guard-rsc'
import { fetchCertServiceWithAuth } from '@/app/api/mobile/_lib/proxy'
import { BasisQuoteListClient } from '@/components/marketing/basis-quote-list'

export default async function BasisQuotesPage() {
  const ctx = await getMarketingAuthContext()
  if (!ctx) redirect('/app')

  const { accessToken } = ctx

  const [quotesRes, variantsRes] = await Promise.all([
    fetchCertServiceWithAuth('/api/marketing/basis-quotes', accessToken),
    fetchCertServiceWithAuth('/api/marketing/grain-variants', accessToken),
  ])

  const quotes = quotesRes.ok ? await quotesRes.json() : []
  const variants = variantsRes.ok ? await variantsRes.json() : []

  return <BasisQuoteListClient quotes={quotes} variants={variants} />
}
