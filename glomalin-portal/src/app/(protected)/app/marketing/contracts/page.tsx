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

  if (!contractsRes.ok) {
    throw new Error(`Failed to load contracts: ${contractsRes.status}`)
  }
  if (!customersRes.ok) {
    throw new Error(`Failed to load customers: ${customersRes.status}`)
  }
  if (!variantsRes.ok) {
    throw new Error(`Failed to load grain variants: ${variantsRes.status}`)
  }

  const contracts = await contractsRes.json()
  const customers = await customersRes.json()
  const variants = await variantsRes.json()

  return <ContractListClient contracts={contracts} customers={customers} variants={variants} role={role} />
}
