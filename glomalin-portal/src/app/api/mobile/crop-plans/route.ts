import { NextResponse } from 'next/server'
import { getMobileUser, isErrorResponse } from '../_lib/auth'
import { fetchBudgetService } from '../_lib/proxy'

/** 60-second in-memory TTL cache to prevent redundant upstream requests on rapid page loads. */
let cached: { data: unknown; expiry: number } | null = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildFieldEntry(field: any, enterpriseLookup: Record<string, string>) {
  return {
    fieldId: field.id,
    fieldName: field.name,
    crop: field.crop ?? '',
    variety: field.seed?.variety ?? '',
    acres: field.plantedAcres ?? field.acres ?? 0,
    enterprise: enterpriseLookup[field.enterpriseId] ?? 'Unassigned',
    enterpriseId: field.enterpriseId,
  }
}

export async function GET(request: Request) {
  const user = await getMobileUser(request)
  if (isErrorResponse(user)) return user

  // Return cached response if still valid
  if (cached && Date.now() < cached.expiry) {
    return NextResponse.json(cached.data)
  }

  try {
    const [enterprisesRes, fieldsRes] = await Promise.all([
      fetchBudgetService('/api/enterprises'),
      fetchBudgetService('/api/fields?all=true'),
    ])

    if (!enterprisesRes.ok) throw new Error(`Enterprises: ${enterprisesRes.status}`)
    if (!fieldsRes.ok) throw new Error(`Fields: ${fieldsRes.status}`)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enterprises: any[] = await enterprisesRes.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fields: any[] = await fieldsRes.json()

    const enterpriseLookup: Record<string, string> = {}
    for (const ent of Array.isArray(enterprises) ? enterprises : []) {
      enterpriseLookup[ent.id] = ent.name
    }

    const fieldList = (Array.isArray(fields) ? fields : [])
      .map((f) => buildFieldEntry(f, enterpriseLookup))
      .sort((a, b) => {
        const entCompare = a.enterprise.localeCompare(b.enterprise)
        if (entCompare !== 0) return entCompare
        return a.fieldName.localeCompare(b.fieldName)
      })

    const response = {
      fields: fieldList,
      syncTimestamp: new Date().toISOString(),
    }

    // Store in TTL cache with 60-second expiry
    cached = { data: response, expiry: Date.now() + 60_000 }

    return NextResponse.json(response)
  } catch {
    return NextResponse.json(
      { error: 'Farm-budget service unavailable' },
      { status: 502 }
    )
  }
}
