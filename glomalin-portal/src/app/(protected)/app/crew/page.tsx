import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchCertService } from '@/app/api/mobile/_lib/proxy'
import { CrewDashboardClient } from './crew-dashboard-client'

export interface CertField {
  id: string
  name: string
  totalAcres: number
  organicStatus: string
}

export interface CertOperation {
  id: string
  type: string
  passStatus: string
  operationDate: string | null
  description: string | null
  notes: string | null
  acresWorked: number | null
  operator: { id: string; name: string } | null
}

export interface CertSeedUsage {
  id: string
  plantingDate: string
  rate: number
  rateUnit: string
  acres: number
  seedLot: {
    id: string
    crop: string
    variety: string
    brand: string | null
    supplier: string | null
    isOrganic: boolean
  }
}

export interface CertMaterialUsage {
  id: string
  applicationDate: string
  rate: number
  rateUnit: string
  acres: number
  applicator: string | null
  notes: string | null
  material: {
    id: string
    name: string
    category: string
    manufacturer: string | null
  }
}

export interface CrewEnterprise {
  id: string
  crop: string
  variety: string | null
  cropYear: number
  plantedAcres: number
  label: string | null
  organicStatus: string
  field: CertField
  operations: {
    planned: CertOperation[]
    completed: CertOperation[]
  }
  seeds: CertSeedUsage[]
  inputs: CertMaterialUsage[]
}

interface RawEnterprise {
  id: string
  crop: string
  variety: string | null
  cropYear: number
  plantedAcres: number
  label: string | null
  organicStatus: string
  field: CertField
  fieldOperations: CertOperation[]
  seedUsages: CertSeedUsage[]
  materialUsages: CertMaterialUsage[]
}

const ALLOWED_ROLES = ['operator', 'admin', 'agronomist', 'owner']

export default async function CrewPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || !ALLOWED_ROLES.includes(profile.role)) redirect('/dashboard')

  const params = await searchParams
  const year = params.year ? parseInt(params.year, 10) : new Date().getFullYear()

  let enterprises: CrewEnterprise[] = []

  try {
    const listRes = await fetchCertService('/api/field-enterprises')
    if (listRes.ok) {
      const all: RawEnterprise[] = await listRes.json()
      const forYear = all.filter((e) => e.cropYear === year)

      const details = await Promise.all(
        forYear.map(async (e) => {
          try {
            const res = await fetchCertService(`/api/field-enterprises/${e.id}`)
            if (!res.ok) return null
            return (await res.json()) as RawEnterprise
          } catch {
            return null
          }
        })
      )

      enterprises = details
        .filter((d): d is RawEnterprise => d !== null)
        .map((d) => ({
          id: d.id,
          crop: d.crop,
          variety: d.variety,
          cropYear: d.cropYear,
          plantedAcres: d.plantedAcres,
          label: d.label,
          organicStatus: d.organicStatus,
          field: d.field,
          operations: {
            planned: (d.fieldOperations ?? []).filter((op) => op.passStatus === 'PLANNED'),
            completed: (d.fieldOperations ?? []).filter((op) => op.passStatus === 'CONFIRMED'),
          },
          seeds: d.seedUsages ?? [],
          inputs: d.materialUsages ?? [],
        }))
    }
  } catch {
    // organic-cert unavailable — render with empty data
  }

  return (
    <CrewDashboardClient
      year={year}
      enterprises={enterprises}
      userName={profile.full_name ?? user.email ?? ''}
    />
  )
}
