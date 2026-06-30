'use client'

import { useState } from 'react'
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
  SortableHeader,
  useSortState,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Empty } from '@/components/ui/empty'
import { formatBu } from '@/lib/fmt'
import { ContractForm, GrainContractRow as BaseContractRow } from '@/components/marketing/contract-form'

// ── Types ────────────────────────────────────────────────────────────────────

// Extended from BaseContractRow with server-computed openBushels field (D-19)
type GrainContractRow = BaseContractRow & {
  openBushels: number
}

interface ContractListClientProps {
  contracts: GrainContractRow[]
  customers: { id: string; name: string; shortCode: string; type: string }[]
  variants: { id: string; name: string; cropYear: number; commodity?: { name: string } }[]
  role: string
}

// ── Constants ────────────────────────────────────────────────────────────────

const INSTRUMENT_BADGE: Record<
  string,
  { label: string; variant: 'default' | 'accent' | 'success' | 'warning' | 'info' }
> = {
  PRICED:        { label: 'PRICED', variant: 'accent' },
  SPOT:          { label: 'SPOT',   variant: 'default' },
  FOB:           { label: 'FOB',    variant: 'default' },
  PRICED_LATER:  { label: 'PTF',    variant: 'warning' },
  BASIS_FIXED:   { label: 'BASIS',  variant: 'info' },
  FUTURES_FIXED: { label: 'HTA',    variant: 'info' },
  MIN_PRICE:     { label: 'MIN',    variant: 'success' },
  ACCUMULATOR:   { label: 'ACCUM',  variant: 'warning' },
}

const INSTRUMENT_LABELS: Record<string, string> = {
  PRICED:        'Priced',
  SPOT:          'Spot',
  FOB:           'FOB',
  PRICED_LATER:  'Price To Follow (PTF)',
  BASIS_FIXED:   'Basis Fixed',
  FUTURES_FIXED: 'HTA (Futures Fixed)',
  MIN_PRICE:     'Min Price',
  ACCUMULATOR:   'Accumulator',
}

const STATUS_LABELS: Record<string, string> = {
  OPEN:             'Open',
  PARTIALLY_FILLED: 'Partially Filled',
  FILLED:           'Filled',
  CANCELLED:        'Cancelled',
  EXPIRED:          'Expired',
}

const filterSelectClass =
  'bg-glomalin-bg border border-glomalin-border text-glomalin-text font-mono text-xs rounded px-2 py-1 focus:outline-none focus:border-glomalin-accent'

const EM_DASH = '—'

// ── Component ────────────────────────────────────────────────────────────────

export function ContractListClient({
  contracts,
  customers,
  variants,
  role,
}: ContractListClientProps) {
  // ── Filter state ─────────────────────────────────────────────────────────
  const [filterYear, setFilterYear] = useState<string>('')
  const [filterVariant, setFilterVariant] = useState<string>('')
  const [filterInstrument, setFilterInstrument] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')

  // ── Drawer state ─────────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editContract, setEditContract] = useState<GrainContractRow | null>(null)

  // ── Sort state ───────────────────────────────────────────────────────────
  const { sortKey, sortDir, onSort } = useSortState('deliveryStartDate')

  // ── Derived values ───────────────────────────────────────────────────────
  const uniqueYears = Array.from(new Set(contracts.map((c) => c.cropYear))).sort(
    (a, b) => a - b
  )

  const uniqueVariants = Array.from(
    new Map(
      contracts.map((c) => [c.variant?.id ?? '', { id: c.variant?.id ?? '', name: c.variant?.name ?? '' }])
    ).values()
  ).filter((v) => v.id !== '')

  const anyFilterActive =
    filterYear !== '' || filterVariant !== '' || filterInstrument !== '' || filterStatus !== ''

  const filtered = contracts.filter((c) => {
    if (filterYear && String(c.cropYear) !== filterYear) return false
    if (filterVariant && (c.variant?.id ?? '') !== filterVariant) return false
    if (filterInstrument && c.instrument !== filterInstrument) return false
    if (filterStatus && c.status !== filterStatus) return false
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (!sortKey || !sortDir) return 0

    let av: string | number | null = null
    let bv: string | number | null = null

    switch (sortKey) {
      case 'customer':
        av = a.customer?.name ?? ''
        bv = b.customer?.name ?? ''
        break
      case 'variant':
        av = a.variant?.name ?? ''
        bv = b.variant?.name ?? ''
        break
      case 'instrument':
        av = a.instrument ?? ''
        bv = b.instrument ?? ''
        break
      case 'cropYear':
        av = a.cropYear
        bv = b.cropYear
        break
      case 'contractedBushels':
        av = a.contractedBushels
        bv = b.contractedBushels
        break
      case 'openBushels':
        av = a.openBushels ?? 0
        bv = b.openBushels ?? 0
        break
      case 'deliveryStartDate':
        av = a.deliveryStartDate ?? a.deliveryStart ?? null
        bv = b.deliveryStartDate ?? b.deliveryStart ?? null
        break
    }

    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1

    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortDir === 'asc' ? cmp : -cmp
  })

  // ── Actions ──────────────────────────────────────────────────────────────
  function openCreate() {
    setEditContract(null)
    setDrawerOpen(true)
  }

  function openEdit(c: GrainContractRow) {
    setEditContract(c)
    setDrawerOpen(true)
  }

  function handleClose() {
    setDrawerOpen(false)
  }

  function handleSaved() {
    setDrawerOpen(false)
    window.location.reload()
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h1 className="font-heading text-lg font-semibold text-glomalin-text">Contracts</h1>
        <button
          onClick={openCreate}
          className="bg-glomalin-accent text-glomalin-bg font-mono font-semibold text-sm rounded px-4 py-2 hover:opacity-90 transition-opacity"
        >
          New Contract
        </button>
      </div>

      {/* Filter strip */}
      <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
        {/* Crop Year */}
        <select
          aria-label="Crop Year"
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          className={filterSelectClass}
        >
          <option value="">All Years</option>
          {uniqueYears.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>

        {/* Variant */}
        <select
          aria-label="Variant"
          value={filterVariant}
          onChange={(e) => setFilterVariant(e.target.value)}
          className={filterSelectClass}
        >
          <option value="">All Variants</option>
          {uniqueVariants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>

        {/* Instrument */}
        <select
          aria-label="Instrument"
          value={filterInstrument}
          onChange={(e) => setFilterInstrument(e.target.value)}
          className={filterSelectClass}
        >
          <option value="">All Types</option>
          {Object.entries(INSTRUMENT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        {/* Status */}
        <select
          aria-label="Status"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className={filterSelectClass}
        >
          <option value="">All Status</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Table or empty state */}
      {contracts.length === 0 ? (
        <Empty
          title="No contracts yet."
          description="Add your first contract to get started."
        />
      ) : filtered.length === 0 ? (
        <Empty title="No contracts match the current filters." />
      ) : (
        <div className="overflow-x-auto rounded border border-glomalin-border mx-4">
          <Table>
            <TableHead>
              <TableRow hover={false}>
                <SortableHeader
                  sortKey="customer"
                  currentKey={sortKey}
                  direction={sortDir}
                  onSort={onSort}
                >
                  CUSTOMER
                </SortableHeader>
                <SortableHeader
                  sortKey="variant"
                  currentKey={sortKey}
                  direction={sortDir}
                  onSort={onSort}
                >
                  VARIANT
                </SortableHeader>
                <SortableHeader
                  sortKey="instrument"
                  currentKey={sortKey}
                  direction={sortDir}
                  onSort={onSort}
                >
                  INSTRUMENT
                </SortableHeader>
                <SortableHeader
                  sortKey="cropYear"
                  currentKey={sortKey}
                  direction={sortDir}
                  onSort={onSort}
                >
                  YEAR
                </SortableHeader>
                <SortableHeader
                  sortKey="contractedBushels"
                  currentKey={sortKey}
                  direction={sortDir}
                  onSort={onSort}
                  className="text-right"
                >
                  CONTRACTED
                </SortableHeader>
                <SortableHeader
                  sortKey="openBushels"
                  currentKey={sortKey}
                  direction={sortDir}
                  onSort={onSort}
                >
                  OPEN
                </SortableHeader>
                <TableHeader>DELIVERY</TableHeader>
                <TableHeader>STATUS</TableHeader>
                <TableHeader className="text-right">ACTIONS</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map((c) => {
                const badge = INSTRUMENT_BADGE[c.instrument] ?? { label: c.instrument, variant: 'default' as const }
                const openBu = c.openBushels ?? 0
                const delivStart = c.deliveryStartDate ?? c.deliveryStart ?? null
                const delivEnd = c.deliveryEndDate ?? c.deliveryEnd ?? null
                const delivDisplay =
                  delivStart
                    ? delivEnd
                      ? `${delivStart.split('T')[0]} – ${delivEnd.split('T')[0]}`
                      : delivStart.split('T')[0]
                    : EM_DASH

                return (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-glomalin-elevated/50 transition-colors">
                    <TableCell className="text-glomalin-text font-sans text-sm">
                      {c.customer?.name ?? EM_DASH}
                    </TableCell>
                    <TableCell className="text-glomalin-text text-sm">
                      {c.variant?.name ?? EM_DASH}
                    </TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-glomalin-muted">
                      {c.cropYear}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-right">
                      {formatBu(c.contractedBushels)}
                    </TableCell>
                    <TableCell
                      className={`font-mono text-sm ${openBu < 0 ? 'text-glomalin-danger' : 'text-glomalin-text'}`}
                    >
                      {formatBu(Math.abs(openBu))}
                      {openBu < 0 && (
                        <span className="text-xs ml-1">(over-applied)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-glomalin-muted">
                      {delivDisplay}
                    </TableCell>
                    <TableCell className="text-sm">
                      {STATUS_LABELS[c.status ?? ''] ?? c.status ?? EM_DASH}
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        aria-label={`Edit contract ${c.id}`}
                        onClick={() => openEdit(c)}
                        className="text-glomalin-accent font-mono text-xs hover:opacity-80 transition-opacity"
                      >
                        Edit
                      </button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60"
            onClick={handleClose}
          />
          {/* Panel */}
          <div className="fixed right-0 top-0 h-full w-[520px] bg-glomalin-surface border-l border-glomalin-border overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-glomalin-border bg-glomalin-surface">
              <h2 className="font-mono text-glomalin-text font-semibold">
                {editContract ? 'Edit Contract' : 'New Contract'}
              </h2>
              <button
                onClick={handleClose}
                className="text-glomalin-muted hover:text-glomalin-text font-mono text-lg leading-none font-semibold"
                aria-label="Close drawer"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              <ContractForm
                contract={editContract}
                customers={customers}
                variants={variants}
                onSuccess={handleSaved}
                open={drawerOpen}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
