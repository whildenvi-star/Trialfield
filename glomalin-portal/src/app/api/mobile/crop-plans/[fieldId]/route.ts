import { NextResponse } from 'next/server'
import { getMobileUser, isErrorResponse } from '../../_lib/auth'
import { fetchBudgetService, fetchCertService } from '../../_lib/proxy'
import { resolveFieldEnterpriseId } from '../../_lib/cert-bridge'

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

    // Build planned passes from farm-budget machinery entries
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plannedPasses = (Array.isArray(field.machinery) ? field.machinery : []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (m: any, idx: number) => ({
        id: m.id ?? crypto.randomUUID(),
        type: m.implementName,
        passNumber: idx + 1,
        status: 'PLANNED' as const,
        operationDate: null as string | null,
        operatorName: null as string | null,
        isUnplanned: false,
        fieldOperationId: null as string | null,
        fieldEnterpriseId: null as string | null,
      })
    )

    // Attempt to merge organic-cert confirmed/unplanned passes
    // Resolve is wrapped in try/catch — gracefully falls back to planned-only if cert is unavailable
    let fieldEnterpriseId: string | null = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let certOperations: any[] = []

    try {
      fieldEnterpriseId = await resolveFieldEnterpriseId(fieldId)
      const certRes = await fetchCertService(`/api/field-enterprises/${fieldEnterpriseId}`)
      if (certRes.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const certEnterprise: any = await certRes.json()
        certOperations = Array.isArray(certEnterprise.fieldOperations)
          ? certEnterprise.fieldOperations
          : []
      }
    } catch {
      // organic-cert unavailable — return planned-only passes
      fieldEnterpriseId = null
      certOperations = []
    }

    // Build a lookup of confirmed ops keyed by budgetImplementId for matching planned passes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const confirmedByBudgetId: Record<string, any> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unplannedOps: any[] = []

    for (const op of certOperations) {
      if (op.budgetImplementId) {
        // This op was confirmed from a planned pass — track by budgetImplementId
        confirmedByBudgetId[op.budgetImplementId] = op
      } else if (op.plannedSource === 'mobile-logger') {
        // Unplanned pass added via mobile logger — include inline
        unplannedOps.push(op)
      }
    }

    // Merge confirmed status into planned passes
    type PlannedPass = typeof plannedPasses[number]
    const mergedPlannedPasses = plannedPasses.map((pass: PlannedPass) => {
      const confirmed = confirmedByBudgetId[pass.id]
      if (confirmed) {
        return {
          ...pass,
          status: 'CONFIRMED' as const,
          operationDate: confirmed.operationDate
            ? new Date(confirmed.operationDate).toISOString().split('T')[0]
            : null,
          operatorName: confirmed.operator?.name ?? null,
          fieldOperationId: confirmed.id,
          fieldEnterpriseId,
        }
      }
      return { ...pass, fieldEnterpriseId }
    })

    // Build unplanned pass entries from mobile-logger ops with no budgetImplementId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unplannedPasses = unplannedOps.map((op: any) => ({
      id: op.id,
      type: op.type,
      passNumber: null as number | null,
      status: 'CONFIRMED' as const,
      operationDate: op.operationDate
        ? new Date(op.operationDate).toISOString().split('T')[0]
        : null,
      operatorName: op.operator?.name ?? null,
      isUnplanned: true,
      fieldOperationId: op.id,
      fieldEnterpriseId,
    }))

    const passes = [...mergedPlannedPasses, ...unplannedPasses]

    const response = {
      fieldId,
      fieldName: field.name,
      crop: field.crop ?? '',
      variety: field.seed?.variety ?? null,
      population: field.seed?.population ?? null,
      seedTreatment: field.seed?.treatment ?? null,
      acres: field.plantedAcres ?? field.acres ?? 0,
      enterprise: enterpriseLookup[field.enterpriseId] ?? 'Unassigned',
      fieldEnterpriseId,
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
