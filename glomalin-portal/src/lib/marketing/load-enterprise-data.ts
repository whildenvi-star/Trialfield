// Server-only data assembly for the enterprise position table.
// Fetches contracts + variants (organic-cert), crop plan (farm-budget),
// actual harvest + settlements (grain-tickets), and live CBOT quotes
// (farm-budget's Yahoo proxy), then runs the pooled rollup.
//
// Every source degrades independently (Promise.allSettled) — a dead service
// nulls its slice of the rollup instead of blanking the page. RBAC is
// payload-level: office callers get rows with financial keys OMITTED.

import {
  fetchCertServiceWithAuth,
  fetchBudgetService,
  fetchGrainService,
} from '@/app/api/mobile/_lib/proxy'
import {
  buildEnterpriseRollup,
  stripRollupFinancials,
} from './enterprise-rollup'
import type {
  BudgetCropRow,
  CommodityRollupRow,
  OfficeCommodityRollupRow,
  RollupContract,
  RollupVariantMeta,
} from './enterprise-rollup'
import { CURRENT_CROP_YEAR } from '@/lib/config'

// farm-budget futures-config keys → commodity symbols
const FUTURES_KEY_TO_SYMBOL: Record<string, string> = {
  corn: 'C',
  soybeans: 'S',
  wheat: 'W',
}

interface FuturesConfigRow {
  key: string
  symbol: string // e.g. "ZCZ26.CBT"
  label: string
  contract: string // e.g. "DEC 26"
}

/**
 * Re-year a futures symbol for a different crop year: same root and month
 * letter, swapped 2-digit year ("ZCZ26.CBT" + 2027 → "ZCZ27.CBT").
 */
export function reYearFuturesSymbol(symbol: string, cropYear: number): string {
  const yy = String(cropYear % 100).padStart(2, '0')
  return symbol.replace(/\d{2}(\.CBT)$/i, `${yy}$1`)
}

export interface EnterpriseDataNotes {
  budgetAvailable: boolean
  ticketsAvailable: boolean
  cbotAvailable: boolean
  /** tickets dropped from yield summaries for missing registry IDs */
  excludedTickets: { noFieldId: number; noCropId: number } | null
}

export interface EnterpriseData {
  rows: CommodityRollupRow[] | OfficeCommodityRollupRow[]
  isOwner: boolean
  cropYear: number
  notes: EnterpriseDataNotes
  /** quote labels by commodity symbol, e.g. { C: "ZCZ26.CBT" } (owner only) */
  cbotContracts: Record<string, string>
}

async function jsonOrNull<T>(res: PromiseSettledResult<Response>): Promise<T | null> {
  if (res.status !== 'fulfilled' || !res.value.ok) return null
  try {
    return (await res.value.json()) as T
  } catch {
    return null
  }
}

export async function loadEnterpriseData(
  accessToken: string,
  role: string,
  cropYear: number
): Promise<EnterpriseData> {
  const isOwner = role === 'owner'

  const [contractsRes, variantsRes, dashboardRes, futuresCfgRes, yieldRes, settleRes] =
    await Promise.allSettled([
      fetchCertServiceWithAuth('/api/marketing/contracts', accessToken),
      fetchCertServiceWithAuth('/api/marketing/grain-variants', accessToken),
      fetchBudgetService('/api/dashboard?yieldMode=projected'),
      fetchBudgetService('/api/futures-config'),
      fetchGrainService(`/api/yield-summaries?cropYear=${cropYear}`),
      fetchGrainService(`/api/settlement-summary?cropYear=${cropYear}`),
    ])

  const allContracts =
    (await jsonOrNull<RollupContract[]>(contractsRes)) ?? []
  const contracts = allContracts.filter((c) => c.cropYear === cropYear)
  const variants = (await jsonOrNull<RollupVariantMeta[]>(variantsRes)) ?? []

  // Budget plan exists only for the current planning year (data.json is single-year)
  interface DashboardResponse {
    enterpriseSummaries?: Array<{ cropRows?: BudgetCropRow[] }>
  }
  let budgetRows: BudgetCropRow[] | null = null
  if (cropYear === CURRENT_CROP_YEAR) {
    const dash = await jsonOrNull<DashboardResponse>(dashboardRes)
    if (dash?.enterpriseSummaries) {
      budgetRows = dash.enterpriseSummaries
        .flatMap((e) => e.cropRows ?? [])
        .filter((r) => r.acres > 0)
    }
  }

  // Live CBOT quotes: futures-config symbols, re-yeared for the selected crop
  const futuresCfg = (await jsonOrNull<FuturesConfigRow[]>(futuresCfgRes)) ?? []
  const cbotBySymbol: Record<string, number | null> = {}
  const cbotContracts: Record<string, string> = {}
  await Promise.all(
    futuresCfg.map(async (cfg) => {
      const commoditySymbol = FUTURES_KEY_TO_SYMBOL[cfg.key]
      if (!commoditySymbol) return
      const quoteSymbol = reYearFuturesSymbol(cfg.symbol, cropYear)
      try {
        const res = await fetchBudgetService(`/api/cbot-fetch?symbol=${encodeURIComponent(quoteSymbol)}`)
        const data = res.ok ? ((await res.json()) as { price?: number | null }) : null
        cbotBySymbol[commoditySymbol] = data?.price ?? null
        cbotContracts[commoditySymbol] = quoteSymbol
      } catch {
        cbotBySymbol[commoditySymbol] = null
      }
    })
  )

  // Actual harvest bushels + settled revenue, keyed by tickets crop name
  interface YieldSummariesResponse {
    summaries?: Array<{ cropName: string; totalNetBU: number }>
    excludedTickets?: { noFieldId: number; noCropId: number }
  }
  interface SettlementSummaryResponse {
    summary?: Array<{ crop: string; netPayment: number }>
  }
  const yieldData = await jsonOrNull<YieldSummariesResponse>(yieldRes)
  const actualBuByTicketCrop: Record<string, number> = {}
  for (const s of yieldData?.summaries ?? []) {
    const key = s.cropName.toLowerCase().trim()
    actualBuByTicketCrop[key] = (actualBuByTicketCrop[key] ?? 0) + s.totalNetBU
  }
  const settleData = await jsonOrNull<SettlementSummaryResponse>(settleRes)
  const settledRevenueByTicketCrop: Record<string, number> = {}
  for (const s of settleData?.summary ?? []) {
    const key = s.crop.toLowerCase().trim()
    settledRevenueByTicketCrop[key] = (settledRevenueByTicketCrop[key] ?? 0) + s.netPayment
  }

  const fullRows = buildEnterpriseRollup({
    cropYear,
    contracts,
    variants,
    budgetRows,
    actualBuByTicketCrop,
    settledRevenueByTicketCrop,
    cbotBySymbol,
    cbotContractBySymbol: cbotContracts,
  })

  return {
    rows: isOwner ? fullRows : stripRollupFinancials(fullRows),
    isOwner,
    cropYear,
    notes: {
      budgetAvailable: budgetRows != null && budgetRows.length > 0,
      ticketsAvailable: yieldData != null,
      cbotAvailable: Object.values(cbotBySymbol).some((p) => p != null),
      excludedTickets: yieldData?.excludedTickets ?? null,
    },
    cbotContracts: isOwner ? cbotContracts : {},
  }
}
