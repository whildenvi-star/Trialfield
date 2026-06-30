import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchCertService } from '@/app/api/mobile/_lib/proxy'

interface CertField {
  id: string
  name: string
  totalAcres: number
  organicStatus: string
}

interface CertEnterpriseSummary {
  id: string
  crop: string
  variety: string | null
  cropYear: number
  plantedAcres: number
  label: string | null
  organicStatus: string
  field: CertField
}

interface CertOperator {
  id: string
  name: string
}

interface CertOperation {
  id: string
  type: string
  passStatus: string
  operationDate: string | null
  description: string | null
  notes: string | null
  acresWorked: number | null
  operator: CertOperator | null
}

interface CertSeedLot {
  id: string
  crop: string
  variety: string
  brand: string | null
  supplier: string | null
  isOrganic: boolean
}

interface CertSeedUsage {
  id: string
  plantingDate: string
  rate: number
  rateUnit: string
  acres: number
  seedLot: CertSeedLot
}

interface CertMaterial {
  id: string
  name: string
  category: string
  manufacturer: string | null
}

interface CertMaterialUsage {
  id: string
  applicationDate: string
  rate: number
  rateUnit: string
  acres: number
  applicator: string | null
  notes: string | null
  material: CertMaterial
}

interface CertEnterpriseDetail extends CertEnterpriseSummary {
  fieldOperations: CertOperation[]
  seedUsages: CertSeedUsage[]
  materialUsages: CertMaterialUsage[]
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  const allowedRoles = ['operator', 'admin', 'agronomist', 'owner']
  if (!profile || !allowedRoles.includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()), 10)

  // Fetch all enterprises and filter to the requested year
  let listRes: Response
  try {
    listRes = await fetchCertService('/api/field-enterprises')
  } catch {
    return NextResponse.json({ error: 'organic-cert service unavailable' }, { status: 502 })
  }

  if (!listRes.ok) {
    return NextResponse.json({ error: 'Failed to fetch enterprises' }, { status: listRes.status })
  }

  const all: CertEnterpriseSummary[] = await listRes.json()
  const forYear = all.filter((e) => e.cropYear === year)

  if (forYear.length === 0) {
    return NextResponse.json({ year, enterprises: [] })
  }

  // Fetch full detail for each enterprise in parallel (includes operations, seeds, inputs)
  const detailResults = await Promise.all(
    forYear.map(async (e) => {
      try {
        const res = await fetchCertService(`/api/field-enterprises/${e.id}`)
        if (!res.ok) return null
        return (await res.json()) as CertEnterpriseDetail
      } catch {
        return null
      }
    })
  )

  const enterprises = detailResults
    .filter((d): d is CertEnterpriseDetail => d !== null)
    .map((d) => ({
      id: d.id,
      crop: d.crop,
      variety: d.variety,
      cropYear: d.cropYear,
      plantedAcres: d.plantedAcres,
      label: d.label,
      organicStatus: d.organicStatus,
      field: {
        id: d.field.id,
        name: d.field.name,
        totalAcres: d.field.totalAcres,
        organicStatus: d.field.organicStatus,
      },
      operations: {
        planned: d.fieldOperations.filter((op) => op.passStatus === 'PLANNED'),
        completed: d.fieldOperations.filter((op) => op.passStatus === 'CONFIRMED'),
      },
      seeds: d.seedUsages,
      inputs: d.materialUsages,
    }))

  return NextResponse.json({ year, enterprises })
}
