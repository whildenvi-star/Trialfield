'use client'

import { useState, useCallback } from 'react'
import type { GrainContract, CbotPrice, MarketingPosition } from '@/lib/marketing/types'
import { CURRENT_CROP_YEAR } from '@/lib/config'
import { PositionTable } from './position-table'
import { ContractDrawer } from './contract-drawer'

interface MarketingWorkspaceProps {
  initialContracts: GrainContract[]
  initialPositions: MarketingPosition[]
  cbotPrices: CbotPrice[]
  priceSource: string
  priceTimestamp: string | null
  yieldAvailable: boolean
}

interface YieldSummary {
  farmId: string
  farmName: string
  registryCropId: string | null
  cropName: string
  cropYear: number
  totalNetBU: number
  acres: number | null
}

/**
 * Compute marketing positions from contracts + yield summaries + CBOT prices.
 * Mirrors the server-side computePositions in page.tsx for client-side refresh.
 */
function computePositions(
  contracts: GrainContract[],
  yieldSummaries: YieldSummary[],
  cbotPrices: CbotPrice[]
): MarketingPosition[] {
  const yieldByRegistryId = new Map<string, number>()
  const yieldByCropName = new Map<string, number>()

  for (const ys of yieldSummaries) {
    if (ys.registryCropId) {
      yieldByRegistryId.set(
        ys.registryCropId,
        (yieldByRegistryId.get(ys.registryCropId) ?? 0) + ys.totalNetBU
      )
    }
    const key = ys.cropName.toLowerCase().trim()
    yieldByCropName.set(key, (yieldByCropName.get(key) ?? 0) + ys.totalNetBU)
  }

  const priceByName = new Map<string, number>()
  for (const p of cbotPrices) {
    priceByName.set(p.commodity.toLowerCase().trim(), p.price)
  }

  const positionMap = new Map<
    string,
    { crop: string; registry_crop_id: string | null; contracts: GrainContract[] }
  >()

  for (const contract of contracts) {
    const key = contract.registry_crop_id
      ? `registry:${contract.registry_crop_id}`
      : `name:${contract.crop.toLowerCase().trim()}`

    if (!positionMap.has(key)) {
      positionMap.set(key, {
        crop: contract.crop,
        registry_crop_id: contract.registry_crop_id,
        contracts: [],
      })
    }
    positionMap.get(key)!.contracts.push(contract)
  }

  // Include yield-only crops (no contracts)
  for (const ys of yieldSummaries) {
    const key = ys.registryCropId
      ? `registry:${ys.registryCropId}`
      : `name:${ys.cropName.toLowerCase().trim()}`

    if (!positionMap.has(key)) {
      positionMap.set(key, {
        crop: ys.cropName,
        registry_crop_id: ys.registryCropId,
        contracts: [],
      })
    }
  }

  const positions: MarketingPosition[] = []

  for (const [, entry] of Array.from(positionMap)) {
    const contracted_bu = entry.contracts.reduce((sum: number, c: GrainContract) => sum + c.bushels, 0)

    let estimated_production_bu = 0
    if (entry.registry_crop_id && yieldByRegistryId.has(entry.registry_crop_id)) {
      estimated_production_bu = yieldByRegistryId.get(entry.registry_crop_id)!
    } else {
      estimated_production_bu = yieldByCropName.get(entry.crop.toLowerCase().trim()) ?? 0
    }

    const unpriced_bu = Math.max(0, estimated_production_bu - contracted_bu)
    const cbot_price = priceByName.get(entry.crop.toLowerCase().trim()) ?? null
    const unpriced_exposure_dollars =
      cbot_price !== null ? unpriced_bu * cbot_price : null

    positions.push({
      crop: entry.crop,
      registry_crop_id: entry.registry_crop_id,
      estimated_production_bu,
      contracted_bu,
      unpriced_bu,
      cbot_price,
      unpriced_exposure_dollars,
      contracts: entry.contracts,
    })
  }

  positions.sort((a, b) => a.crop.localeCompare(b.crop))
  return positions
}

function formatPriceTimestamp(ts: string | null): string {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return ts
  }
}

function priceSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    'barchart-delayed': 'Barchart Delayed',
    'manual-fallback': 'Manual Fallback',
    unavailable: 'Unavailable',
  }
  return labels[source] ?? source
}

export function MarketingWorkspace({
  initialContracts,
  initialPositions,
  cbotPrices: initialCbotPrices,
  priceSource: initialPriceSource,
  priceTimestamp: initialPriceTimestamp,
  yieldAvailable,
}: MarketingWorkspaceProps) {
  const [contracts, setContracts] = useState<GrainContract[]>(initialContracts)
  const [positions, setPositions] = useState<MarketingPosition[]>(initialPositions)
  const [cbotPrices, setCbotPrices] = useState<CbotPrice[]>(initialCbotPrices)
  const [priceSource, setPriceSource] = useState(initialPriceSource)
  const [priceTimestamp, setPriceTimestamp] = useState<string | null>(initialPriceTimestamp)
  const [priceRefreshing, setPriceRefreshing] = useState(false)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create')
  const [editingContract, setEditingContract] = useState<GrainContract | null>(null)

  // Yield summaries are server-loaded at page load; client uses cached copy for recompute
  // (yield summaries won't change during a session — no client-side refetch needed)
  const [yieldSummaries] = useState<YieldSummary[]>([])

  const recomputePositions = useCallback(
    (updatedContracts: GrainContract[], updatedPrices: CbotPrice[]) => {
      setPositions(computePositions(updatedContracts, yieldSummaries, updatedPrices))
    },
    [yieldSummaries]
  )

  async function handleRefreshPrices() {
    setPriceRefreshing(true)
    try {
      const res = await fetch('/api/marketing/cbot-prices', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const prices: CbotPrice[] = data.prices ?? []
      setCbotPrices(prices)
      if (prices.length > 0) {
        setPriceSource(prices[0].source)
        setPriceTimestamp(prices[0].timestamp)
      }
      recomputePositions(contracts, prices)
    } catch (err) {
      console.error('Failed to refresh CBOT prices:', err)
    } finally {
      setPriceRefreshing(false)
    }
  }

  async function fetchContracts(): Promise<GrainContract[]> {
    try {
      const res = await fetch(
        `/api/marketing/contracts?cropYear=${CURRENT_CROP_YEAR}`,
        { cache: 'no-store' }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      return (data.contracts as GrainContract[]) ?? []
    } catch (err) {
      console.error('Failed to fetch contracts:', err)
      return contracts
    }
  }

  function openCreateDrawer() {
    setEditingContract(null)
    setDrawerMode('create')
    setDrawerOpen(true)
  }

  function openEditDrawer(contract: GrainContract) {
    setEditingContract(contract)
    setDrawerMode('edit')
    setDrawerOpen(true)
  }

  async function handleDrawerSave() {
    setDrawerOpen(false)
    const updated = await fetchContracts()
    setContracts(updated)
    recomputePositions(updated, cbotPrices)
  }

  async function handleDeleteContract(id: string) {
    const contract = contracts.find((c) => c.id === id)
    const label = `${contract?.crop ?? 'contract'} — ${contract?.bushels?.toLocaleString() ?? '?'} bu`
    if (!confirm(`Delete ${label}?`)) return

    try {
      const res = await fetch(`/api/marketing/contracts/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('Failed to delete contract:', err)
        return
      }
      const updated = contracts.filter((c) => c.id !== id)
      setContracts(updated)
      recomputePositions(updated, cbotPrices)
    } catch (err) {
      console.error('Network error deleting contract:', err)
    }
  }

  const isLivePrices = priceSource === 'barchart-delayed'
  const isFallbackPrices = priceSource === 'manual-fallback'

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-mono font-semibold text-glomalin-accent">
            Grain Marketing Position
          </h1>
          <p className="text-glomalin-muted text-sm mt-1 font-mono">
            {CURRENT_CROP_YEAR} crop year — estimated production vs. contracted bushels
          </p>
        </div>
        <button
          onClick={openCreateDrawer}
          className="font-mono text-sm font-bold bg-glomalin-accent text-glomalin-bg rounded px-4 py-2 hover:opacity-90 transition-opacity"
        >
          Add Contract
        </button>
      </div>

      {/* CBOT price source badge + refresh */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-mono font-semibold border ${
            isLivePrices
              ? 'bg-green-900/30 border-green-700 text-green-300'
              : isFallbackPrices
              ? 'bg-orange-900/30 border-orange-700 text-orange-300'
              : 'bg-glomalin-surface border-glomalin-border text-glomalin-muted'
          }`}
        >
          <span>{priceSourceLabel(priceSource)}</span>
          {priceTimestamp && (
            <span className="text-opacity-75">— {formatPriceTimestamp(priceTimestamp)}</span>
          )}
        </div>
        <button
          onClick={handleRefreshPrices}
          disabled={priceRefreshing}
          className="text-xs font-mono text-glomalin-muted hover:text-glomalin-accent transition-colors disabled:opacity-50"
        >
          {priceRefreshing ? 'Refreshing...' : 'Refresh Prices'}
        </button>
      </div>

      {/* Grain-tickets offline warning */}
      {!yieldAvailable && (
        <div className="mb-6 rounded-md border border-orange-800/50 bg-orange-950/30 px-4 py-3 text-sm font-mono">
          <p className="text-orange-400 font-semibold">
            Grain-tickets offline — estimated production unavailable
          </p>
          <p className="text-orange-300 text-xs mt-0.5">
            Start grain-tickets on port 3007 to see per-crop estimated production totals.
            Contracts and CBOT exposure still visible.
          </p>
        </div>
      )}

      {/* Position table */}
      <PositionTable
        positions={positions}
        onEditContract={openEditDrawer}
        onDeleteContract={handleDeleteContract}
      />

      {/* Contract create/edit drawer */}
      <ContractDrawer
        open={drawerOpen}
        mode={drawerMode}
        contract={editingContract}
        onClose={() => setDrawerOpen(false)}
        onSave={handleDrawerSave}
      />
    </div>
  )
}
