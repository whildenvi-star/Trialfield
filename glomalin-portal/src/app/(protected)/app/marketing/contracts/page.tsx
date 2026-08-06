import { redirect } from 'next/navigation'
import { getMarketingAuthContext } from '@/lib/supabase/marketing-guard-rsc'
import { fetchCertServiceWithAuth } from '@/app/api/mobile/_lib/proxy'
import { ContractListClient } from '@/components/marketing/contract-list'
import { EnterprisePositionTable } from '@/components/marketing/enterprise-position-table'
import { loadEnterpriseData } from '@/lib/marketing/load-enterprise-data'
import { CURRENT_CROP_YEAR } from '@/lib/config'

export default async function ContractsPage() {
  const ctx = await getMarketingAuthContext()
  if (!ctx) redirect('/app')

  const { role, accessToken } = ctx

  const [contractsRes, customersRes, variantsRes, enterprise] = await Promise.all([
    fetchCertServiceWithAuth('/api/marketing/contracts', accessToken),
    fetchCertServiceWithAuth('/api/marketing/customers?dropdown=true', accessToken),
    fetchCertServiceWithAuth('/api/marketing/grain-variants', accessToken),
    loadEnterpriseData(accessToken, role, CURRENT_CROP_YEAR),
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

  return (
    <div className="space-y-4">
      <EnterprisePositionTable
        rows={enterprise.rows}
        isOwner={enterprise.isOwner}
        cropYear={enterprise.cropYear}
        notes={enterprise.notes}
        defaultOpen={false}
      />
      <ContractListClient contracts={contracts} customers={customers} variants={variants} role={role} />
    </div>
  )
}
