import { NextResponse } from 'next/server'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'
import { fetchBudgetService } from '../_lib/proxy'

interface BudgetProduct {
  productName?: string
  unit?: string
  billedQty?: number
  orderedQty?: number
  deliveredQty?: number
  remaining?: number
  pctOrdered?: number
  supplierName?: string
}

interface BudgetCategory {
  name: string
  products: BudgetProduct[]
}

export interface SupplyProduct {
  name: string
  unit: string
  totalQty: number
  orderedQty: number
  deliveredQty: number
  remaining: number
  pctFilled: number
  supplier: string | null
}

export interface SupplyCategory {
  category: string
  products: SupplyProduct[]
}

export interface SupplyResponse {
  categories: SupplyCategory[]
  summary: {
    totalProducts: number
    fullyDelivered: number
    partiallyOrdered: number
    notStarted: number
  }
}

export async function GET() {
  const guard = await requireModuleAccess('fsa-578')
  if (isGuardError(guard)) return guard

  try {
    const res = await fetchBudgetService('/api/forecast')
    if (!res.ok) {
      return NextResponse.json({ categories: [], summary: { totalProducts: 0, fullyDelivered: 0, partiallyOrdered: 0, notStarted: 0 } })
    }

    const data: { categories: BudgetCategory[] } = await res.json()

    let totalProducts = 0
    let fullyDelivered = 0
    let partiallyOrdered = 0
    let notStarted = 0

    const categories: SupplyCategory[] = (data.categories ?? []).map((cat) => {
      const products: SupplyProduct[] = (cat.products ?? []).map((p) => {
        const total = p.billedQty ?? 0
        const ordered = p.orderedQty ?? 0
        const delivered = p.deliveredQty ?? 0
        const remaining = p.remaining ?? (total - ordered)
        const pctFilled = total > 0 ? Math.round((delivered / total) * 100) : 0

        totalProducts++
        if (delivered >= total && total > 0) fullyDelivered++
        else if (ordered > 0) partiallyOrdered++
        else notStarted++

        return {
          name: p.productName ?? '',
          unit: p.unit ?? '',
          totalQty: total,
          orderedQty: ordered,
          deliveredQty: delivered,
          remaining,
          pctFilled,
          supplier: p.supplierName ?? null,
        }
      })

      return { category: cat.name, products }
    })

    return NextResponse.json({
      categories,
      summary: { totalProducts, fullyDelivered, partiallyOrdered, notStarted },
    } satisfies SupplyResponse)
  } catch {
    return NextResponse.json(
      { categories: [], summary: { totalProducts: 0, fullyDelivered: 0, partiallyOrdered: 0, notStarted: 0 } },
      { status: 500 }
    )
  }
}
