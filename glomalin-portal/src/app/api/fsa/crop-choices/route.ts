import { NextResponse } from 'next/server'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'
import { fetchBudgetService } from '@/app/api/mobile/_lib/proxy'

export async function GET() {
  const guard = await requireModuleAccess('fsa-578')
  if (isGuardError(guard)) return guard

  try {
    const res = await fetchBudgetService('/api/enterprises')
    if (!res.ok) return NextResponse.json({ crops: [] })
    const enterprises: { cropTypeNames?: unknown[] }[] = await res.json()

    const cropSet = new Set<string>()
    for (const ent of enterprises) {
      for (const crop of ent.cropTypeNames ?? []) {
        if (crop) cropSet.add(String(crop).trim())
      }
    }
    return NextResponse.json({ crops: Array.from(cropSet).sort() })
  } catch {
    return NextResponse.json({ crops: [] })
  }
}
