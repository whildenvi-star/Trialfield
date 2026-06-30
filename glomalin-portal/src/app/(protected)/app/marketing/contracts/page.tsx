import { redirect } from 'next/navigation'
import { getMarketingAuthContext } from '@/lib/supabase/marketing-guard-rsc'
import { fetchCertServiceWithAuth } from '@/app/api/mobile/_lib/proxy'
import { ContractListClient } from '@/components/marketing/contract-list'

export default async function ContractsPage() {
  const ctx = await getMarketingAuthContext()
  if (!ctx) redirect('/app')

  const { role, accessToken } = ctx

  const [contractsRes, customersRes, variantsRes] = await Promise.all([
    fetchCertServiceWithAuth('/api/marketing/contracts', accessToken),
    fetchCertServiceWithAuth('/api/marketing/customers?dropdown=true', accessToken),
    fetchCertServiceWithAuth('/api/marketing/grain-variants', accessToken),
  ])

  const contracts = contractsRes.ok ? await contractsRes.json() : []
  const customers = customersRes.ok ? await customersRes.json() : []
  const variants = variantsRes.ok ? await variantsRes.json() : []

  return <ContractListClient contracts={contracts} customers={customers} variants={variants} role={role} />
}
