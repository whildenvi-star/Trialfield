import { NextResponse } from 'next/server'
import { getMobileUser, isErrorResponse } from '../../_lib/auth'
import { fetchBudgetService, fetchCertService } from '../../_lib/proxy'

type ActivityCategory = 'FERTILITY' | 'SEEDING' | 'TILLAGE' | 'SPRAYING' | 'HARVEST' | 'OTHER'

function categorizeOperation(type: string): ActivityCategory {
  const t = (type ?? '').toLowerCase()
  if (/plant|seed(?!corn)|drill/.test(t)) return 'SEEDING'
  if (/anhydrous|fertil|lime|manure|nitrogen|n-serve|10-34|urea|ammonia|sulfur|potash|phosph|dap\b|map\b/.test(t)) return 'FERTILITY'
  if (/cultivat|disc|chisel|till|field cult|subsoil|plow|rip|vertical/.test(t)) return 'TILLAGE'
  if (/spray|herbicide|fungicide|insecti|chemical|boom/.test(t)) return 'SPRAYING'
  if (/harvest|combin|chop|mow|swath|bale/.test(t)) return 'HARVEST'
  return 'OTHER'
}

const CATEGORY_ORDER: ActivityCategory[] = ['FERTILITY', 'SEEDING', 'TILLAGE', 'SPRAYING', 'HARVEST', 'OTHER']

export async function GET(
  request: Request,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  const user = await getMobileUser(request)
  if (isErrorResponse(user)) return user

  const { enterpriseId } = await params
  const isOwner = user.role === 'owner' || user.role === 'admin'
  const currentYear = new Date().getFullYear()

  try {
    // Phase 1: fetch budget data and cert field index in parallel
    const [enterprisesRes, allFieldsRes, certFieldsRes, certEnterprisesRes, dashboardRes] =
      await Promise.all([
        fetchBudgetService('/api/enterprises'),
        fetchBudgetService('/api/fields?all=true'),
        fetchCertService('/api/fields'),
        fetchCertService('/api/field-enterprises'),
        isOwner ? fetchBudgetService('/api/dashboard?yieldMode=projected') : Promise.resolve(null),
      ])

    if (!enterprisesRes.ok) throw new Error(`Enterprises: ${enterprisesRes.status}`)
    if (!allFieldsRes.ok) throw new Error(`Fields: ${allFieldsRes.status}`)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allEnterprises: any[] = await enterprisesRes.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allFields: any[] = await allFieldsRes.json()

    const enterprise = Array.isArray(allEnterprises)
      ? allEnterprises.find((e) => e.id === enterpriseId)
      : null
    if (!enterprise) {
      return NextResponse.json({ error: 'Enterprise not found' }, { status: 404 })
    }

    const budgetFields = (Array.isArray(allFields) ? allFields : []).filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (f: any) => f.enterpriseId === enterpriseId
    )

    if (budgetFields.length === 0) {
      return NextResponse.json({ error: 'No fields found for enterprise' }, { status: 404 })
    }

    // Fetch full detail for the first field to get variety, population, inputs, machinery
    const firstFieldRes = await fetchBudgetService('/api/fields/' + budgetFields[0].id)
    if (!firstFieldRes.ok) throw new Error(`Field detail: ${firstFieldRes.status}`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const firstField: any = await firstFieldRes.json()

    const totalAcres = budgetFields.reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sum: number, f: any) => sum + (f.plantedAcres ?? f.acres ?? 0),
      0
    )

    // Build inputs with enterprise-total quantities
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inputs = (Array.isArray(firstField.inputs) ? firstField.inputs : [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((i: any) => i.productName)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((i: any) => {
        const rateNum = parseFloat(String(i.quantity ?? 0))
        return {
          product: i.productName,
          ratePerAcre: String(i.quantity ?? ''),
          unit: i.unit ?? 'per acre',
          totalForEnterprise: isNaN(rateNum) ? 0 : Math.round(rateNum * totalAcres * 10) / 10,
        }
      })

    // Build planned passes from machinery entries
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plannedPasses = (Array.isArray(firstField.machinery) ? firstField.machinery : []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (m: any, idx: number) => ({
        id: m.id ?? String(idx),
        type: m.implementName,
        passNumber: idx + 1,
      })
    )

    // Build cert lookup structures
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const certFields: any[] = certFieldsRes?.ok ? await certFieldsRes.json() : []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const certFieldEnterprisesList: any[] = certEnterprisesRes?.ok
      ? await certEnterprisesRes.json()
      : []

    // registryId -> cert field
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const certFieldByRegistryId: Record<string, any> = {}
    for (const cf of Array.isArray(certFields) ? certFields : []) {
      if (cf.registryId) certFieldByRegistryId[cf.registryId] = cf
    }

    // cert field id -> current-year field enterprise
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const certEnterpriseByFieldId: Record<string, any> = {}
    for (const ce of Array.isArray(certFieldEnterprisesList) ? certFieldEnterprisesList : []) {
      if (ce.cropYear === currentYear) {
        certEnterpriseByFieldId[ce.fieldId] = ce
      }
    }

    // Fetch per-field confirmed operations in parallel
    const fieldResults = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      budgetFields.map(async (budgetField: any) => {
        const certField = certFieldByRegistryId[budgetField.id]
        const certFieldEnterprise = certField
          ? certEnterpriseByFieldId[certField.id]
          : null

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let certOps: any[] = []
        if (certFieldEnterprise) {
          try {
            const certRes = await fetchCertService(
              `/api/field-enterprises/${certFieldEnterprise.id}`
            )
            if (certRes.ok) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const certData: any = await certRes.json()
              certOps = Array.isArray(certData.fieldOperations) ? certData.fieldOperations : []
            }
          } catch {
            // cert unavailable — fall back to planned-only passes
          }
        }

        // Build confirmed op lookup by budgetImplementId
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const confirmedByBudgetId: Record<string, any> = {}
        for (const op of certOps) {
          if (op.budgetImplementId) {
            confirmedByBudgetId[op.budgetImplementId] = op
          }
        }

        // Merge confirmation status into planned passes
        const passes = plannedPasses.map((pass: { id: string; type: string; passNumber: number }) => {
          const confirmed = confirmedByBudgetId[pass.id]
          if (confirmed) {
            return {
              type: pass.type,
              passNumber: pass.passNumber,
              status: 'CONFIRMED' as const,
              operationDate: confirmed.operationDate
                ? new Date(confirmed.operationDate).toISOString().split('T')[0]
                : null,
              operatorName: confirmed.operator?.name ?? null,
            }
          }
          return {
            type: pass.type,
            passNumber: pass.passNumber,
            status: 'PLANNED' as const,
            operationDate: null,
            operatorName: null,
          }
        })

        return {
          fieldId: budgetField.id,
          fieldName: budgetField.name,
          acres: budgetField.plantedAcres ?? budgetField.acres ?? 0,
          organicStatus: certField?.organicStatus ?? '',
          passes,
        }
      })
    )

    // Build owner financial data from dashboard if applicable
    let financials: {
      avgProfitPerAcre: number
      totalProfit: number
      avgExpPerAcre: number
      cropProfit: number
    } | undefined

    if (isOwner && dashboardRes?.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dashboard: any = await dashboardRes.json()
      const allDashboardEnterprises = [
        ...(dashboard.conventional ?? []),
        ...(dashboard.organic ?? []),
      ]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dashEntry = allDashboardEnterprises.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (e: any) => e.enterprise?.id === enterpriseId
      )
      if (dashEntry?.totals) {
        const t = dashEntry.totals
        const avgProfit = t.avgProfitPerAcre ?? 0
        financials = {
          avgProfitPerAcre: avgProfit,
          totalProfit: Math.round(avgProfit * totalAcres),
          avgExpPerAcre: t.avgExpPerAcre ?? 0,
          cropProfit: t.cropProfit ?? 0,
        }
      }
    }

    // Build enterprise-level timeline: aggregate pass status across all fields
    const timelineMap = new Map<string, {
      passNumber: number | null
      type: string
      category: ActivityCategory
      confirmedCount: number
      totalFields: number
      latestDate: string | null
      latestOperator: string | null
    }>()

    for (const field of fieldResults) {
      for (const pass of field.passes) {
        const key = `${pass.passNumber ?? 'x'}-${pass.type}`
        const existing = timelineMap.get(key)
        if (!existing) {
          timelineMap.set(key, {
            passNumber: pass.passNumber,
            type: pass.type,
            category: categorizeOperation(pass.type),
            confirmedCount: pass.status === 'CONFIRMED' ? 1 : 0,
            totalFields: 1,
            latestDate: pass.operationDate,
            latestOperator: pass.operatorName,
          })
        } else {
          existing.totalFields++
          if (pass.status === 'CONFIRMED') {
            existing.confirmedCount++
            if (pass.operationDate && (!existing.latestDate || pass.operationDate > existing.latestDate)) {
              existing.latestDate = pass.operationDate
              existing.latestOperator = pass.operatorName
            }
          }
        }
      }
    }

    const timeline = Array.from(timelineMap.values())
      .map(e => ({
        passNumber: e.passNumber,
        type: e.type,
        category: e.category,
        status: e.confirmedCount === 0
          ? ('PLANNED' as const)
          : e.confirmedCount === e.totalFields
            ? ('CONFIRMED' as const)
            : ('PARTIAL' as const),
        confirmedCount: e.confirmedCount,
        totalFields: e.totalFields,
        operationDate: e.latestDate,
        operatorName: e.latestOperator,
      }))
      .sort((a, b) => {
        const catA = CATEGORY_ORDER.indexOf(a.category)
        const catB = CATEGORY_ORDER.indexOf(b.category)
        if (catA !== catB) return catA - catB
        return (a.passNumber ?? 99) - (b.passNumber ?? 99)
      })

    const response = {
      enterpriseId,
      enterpriseName: enterprise.name,
      crop: firstField.crop ?? budgetFields[0].crop ?? '',
      cropYear: currentYear,
      totalAcres,
      variety: firstField.seed?.variety ?? null,
      population: firstField.seed?.population ?? null,
      seedTreatment: firstField.seed?.treatment ?? null,
      inputs,
      fields: fieldResults,
      timeline,
      ...(financials ? { financials } : {}),
    }

    return NextResponse.json(response)
  } catch {
    return NextResponse.json(
      { error: 'Farm-budget service unavailable' },
      { status: 502 }
    )
  }
}
