import { NextResponse } from 'next/server'
import { getMobileUser, isErrorResponse } from '../_lib/auth'
import { fetchBudgetService } from '../_lib/proxy'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cleanProgram(p: any) {
  return {
    id: p.id,
    name: p.name,
    crop: p.crop,
    systemCode: p.systemCode,
    yieldPerAcre: p.yieldPerAcre,
    yieldUnit: p.yieldUnit,
    harvestMoisture: p.harvestMoisture,
    inputs: (p.inputs ?? []).map((i: Record<string, unknown>) => ({
      productName: i.productName,
      quantity: i.quantity,
      season: i.season,
    })),
    seed: p.seed
      ? { variety: p.seed.variety, population: p.seed.population }
      : null,
    machinery: (p.machinery ?? []).map((m: Record<string, unknown>) => ({
      implementName: m.implementName,
      passes: m.passes,
    })),
  }
}

export async function GET(request: Request) {
  const user = await getMobileUser(request)
  if (isErrorResponse(user)) return user

  try {
    const res = await fetchBudgetService('/api/programs')
    if (!res.ok) throw new Error(`Programs: ${res.status}`)

    const programs = await res.json()

    return NextResponse.json({
      programs: (Array.isArray(programs) ? programs : []).map(cleanProgram),
    })
  } catch {
    return NextResponse.json(
      { error: 'Farm-budget service unavailable' },
      { status: 502 }
    )
  }
}
