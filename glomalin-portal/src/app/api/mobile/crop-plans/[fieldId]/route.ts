import { NextResponse } from 'next/server'
import { getMobileUser, isErrorResponse } from '../../_lib/auth'
import { fetchBudgetService } from '../../_lib/proxy'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fieldId: string }> }
) {
  const user = await getMobileUser(request)
  if (isErrorResponse(user)) return user

  const { fieldId } = await params

  try {
    const [fieldRes, enterprisesRes] = await Promise.all([
      fetchBudgetService('/api/fields/' + fieldId),
      fetchBudgetService('/api/enterprises'),
    ])

    if (fieldRes.status === 404) {
      return NextResponse.json({ error: 'Field not found' }, { status: 404 })
    }
    if (!fieldRes.ok) throw new Error(`Field: ${fieldRes.status}`)
    if (!enterprisesRes.ok) throw new Error(`Enterprises: ${enterprisesRes.status}`)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const field: any = await fieldRes.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enterprises: any[] = await enterprisesRes.json()

    const enterpriseLookup: Record<string, string> = {}
    for (const ent of Array.isArray(enterprises) ? enterprises : []) {
      enterpriseLookup[ent.id] = ent.name
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inputs = (Array.isArray(field.inputs) ? field.inputs : [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((i: any) => i.productName)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((i: any) => ({
        product: i.productName,
        rate: String(i.quantity ?? ''),
        unit: i.unit ?? 'per acre',
      }))

    // Each machinery entry is a planned pass — organic-cert enrichment deferred to Phase 46
    const passes = (Array.isArray(field.machinery) ? field.machinery : [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((m: any, idx: number) => ({
        id: m.id ?? crypto.randomUUID(),
        type: m.implementName,
        passNumber: idx + 1,
        status: 'PLANNED' as const,
        operationDate: null,
        operatorName: null,
      }))

    const response = {
      fieldId,
      fieldName: field.name,
      crop: field.crop ?? '',
      variety: field.seed?.variety ?? null,
      population: field.seed?.population ?? null,
      seedTreatment: field.seed?.treatment ?? null,
      acres: field.plantedAcres ?? field.acres ?? 0,
      enterprise: enterpriseLookup[field.enterpriseId] ?? 'Unassigned',
      inputs,
      passes,
      syncTimestamp: new Date().toISOString(),
    }

    return NextResponse.json(response)
  } catch {
    return NextResponse.json(
      { error: 'Farm-budget service unavailable' },
      { status: 502 }
    )
  }
}
