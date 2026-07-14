'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { Empty } from '@/components/ui/empty'
import { formatBu } from '@/lib/fmt'
import { DeliveryForm, DeliveryRow } from '@/components/marketing/delivery-form'

export type GrainDeliveryRow = DeliveryRow & {
  variant: { id: string; name: string }
  customer: { id: string; name: string; shortCode: string }
}

interface DeliveryListClientProps {
  deliveries: GrainDeliveryRow[]
  contracts: {
    id: string
    instrument: string
    contractedBushels: number
    openBushels: number
    customer: { name: string; shortCode: string }
    variant: { name: string }
  }[]
  role: string
}

const filterSelectClass =
  'bg-glomalin-elevated border border-glomalin-border text-glomalin-text font-mono text-xs rounded-md px-2 py-1 focus:outline-none focus:border-glomalin-accent transition-colors'

const EM_DASH = '—'

export function DeliveryListClient({
  deliveries,
  role,
}: DeliveryListClientProps) {
  const router = useRouter()

  const [filterYear, setFilterYear] = useState<string>('')
  const [filterVariant, setFilterVariant] = useState<string>('')
  const [filterCustomer, setFilterCustomer] = useState<string>('')
  const [filterUnmatched, setFilterUnmatched] = useState<boolean>(false)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editDelivery, setEditDelivery] = useState<GrainDeliveryRow | null>(null)
  const formIsDirtyRef = useRef(false)

  const { sortKey, sortDir, onSort } = useSortState('deliveryDate')

  const uniqueYears = useMemo(
    () =>
      Array.from(new Set(deliveries.map((d) => d.deliveryDate.slice(0, 4)))).sort(
        (a, b) => Number(a) - Number(b)
      ),
    [deliveries]
  )

  const uniqueVariants = useMemo(
    () =>
      Array.from(
        new Map(deliveries.map((d) => [d.variant.id, d.variant])).values()
      ),
    [deliveries]
  )

  const uniqueCustomers = useMemo(
    () =>
      Array.from(
        new Map(deliveries.map((d) => [d.customer.id, d.customer])).values()
      ),
    [deliveries]
  )

  const variants = uniqueVariants
  const customers = uniqueCustomers

  const filtered = deliveries.filter((d) => {
    if (filterYear && d.deliveryDate.slice(0, 4) !== filterYear) return false
    if (filterVariant && d.variant.id !== filterVariant) return false
    if (filterCustomer && d.customer.id !== filterCustomer) return false
    if (filterUnmatched && d.unappliedBushels <= 0) return false
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (!sortKey || !sortDir) return 0

    let av: string | number | null = null
    let bv: string | number | null = null

    switch (sortKey) {
      case 'deliveryDate':
        av = a.deliveryDate
        bv = b.deliveryDate
        break
      case 'netBushels':
        av = a.netBushels
        bv = b.netBushels
        break
      case 'unappliedBushels':
        av = a.unappliedBushels
        bv = b.unappliedBushels
        break
      case 'customer':
        av = a.customer?.name ?? ''
        bv = b.customer?.name ?? ''
        break
      case 'variant':
        av = a.variant?.name ?? ''
        bv = b.variant?.name ?? ''
        break
    }

    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1

    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortDir === 'asc' ? cmp : -cmp
  })

  function openCreate() {
    formIsDirtyRef.current = false
    setEditDelivery(null)
    setDrawerOpen(true)
  }

  function openEdit(d: GrainDeliveryRow) {
    formIsDirtyRef.current = false
    setEditDelivery(d)
    setDrawerOpen(true)
  }

  function handleClose() {
    if (formIsDirtyRef.current) {
      if (!window.confirm('Discard unsaved changes?')) return
    }
    formIsDirtyRef.current = false
    setDrawerOpen(false)
  }

  function handleSaved() {
    setDrawerOpen(false)
    window.location.reload()
  }

  return (
    <div>
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h1 className="font-heading text-lg font-semibold text-glomalin-text">Deliveries</h1>
        <button
          onClick={openCreate}
          className="bg-glomalin-accent text-glomalin-bg font-mono font-semibold text-sm rounded px-4 py-2 hover:opacity-90 transition-opacity"
        >
          Log Delivery
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
        <select
          aria-label="Year"
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          className={filterSelectClass}
        >
          <option value="">All Years</option>
          {uniqueYears.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <select
          aria-label="Variant"
          value={filterVariant}
          onChange={(e) => setFilterVariant(e.target.value)}
          className={filterSelectClass}
        >
          <option value="">All Variants</option>
          {uniqueVariants.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>

        <select
          aria-label="Buyer"
          value={filterCustomer}
          onChange={(e) => setFilterCustomer(e.target.value)}
          className={filterSelectClass}
        >
          <option value="">All Buyers</option>
          {uniqueCustomers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 font-mono text-xs text-glomalin-text cursor-pointer">
          <input
            type="checkbox"
            checked={filterUnmatched}
            onChange={(e) => setFilterUnmatched(e.target.checked)}
            className="accent-glomalin-accent"
          />
          Unmatched only
        </label>
      </div>

      {deliveries.length === 0 ? (
        <Empty title="No deliveries yet." description="Log your first delivery to get started." />
      ) : filtered.length === 0 ? (
        <Empty title="No deliveries match the current filters." />
      ) : (
        <div className="overflow-x-auto rounded border border-glomalin-border mx-4">
          <Table>
            <TableHead>
              <TableRow hover={false}>
                <SortableHeader sortKey="deliveryDate" currentKey={sortKey} direction={sortDir} onSort={onSort}>DATE</SortableHeader>
                <SortableHeader sortKey="customer" currentKey={sortKey} direction={sortDir} onSort={onSort}>BUYER</SortableHeader>
                <SortableHeader sortKey="variant" currentKey={sortKey} direction={sortDir} onSort={onSort}>VARIANT</SortableHeader>
                <SortableHeader sortKey="netBushels" currentKey={sortKey} direction={sortDir} onSort={onSort} className="text-right">NET BU</SortableHeader>
                <SortableHeader sortKey="unappliedBushels" currentKey={sortKey} direction={sortDir} onSort={onSort}>UNAPPLIED</SortableHeader>
                <TableHeader className="text-right">ACTIONS</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map((d) => (
                <TableRow key={d.id} className="hover:bg-glomalin-elevated/50 transition-colors">
                  <TableCell className="font-mono text-sm text-glomalin-muted">{d.deliveryDate.slice(0, 10)}</TableCell>
                  <TableCell className="text-glomalin-text text-sm">{d.customer?.name ?? EM_DASH}</TableCell>
                  <TableCell className="text-glomalin-text text-sm">{d.variant?.name ?? EM_DASH}</TableCell>
                  <TableCell className="font-mono text-sm text-right">{formatBu(d.netBushels)}</TableCell>
                  <TableCell className={`font-mono text-sm ${d.unappliedBushels > 0 ? 'text-glomalin-warning' : 'text-glomalin-muted'}`}>
                    {formatBu(d.unappliedBushels)}
                    {d.unappliedBushels > 0 && <span className="text-xs ml-1">(unmatched)</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        aria-label={`Edit delivery ${d.id}`}
                        onClick={() => openEdit(d)}
                        className="text-glomalin-accent font-mono text-xs hover:opacity-80 transition-opacity"
                      >
                        Edit
                      </button>
                      <button
                        aria-label={`Apply delivery ${d.id}`}
                        onClick={() => router.push(`/app/marketing/deliveries/${d.id}/apply`)}
                        className="text-glomalin-accent font-mono text-xs hover:opacity-80 transition-opacity"
                      >
                        Apply
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {drawerOpen && (
        <div className="fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px]" onClick={handleClose} />
          <div className="fixed right-0 top-0 h-full w-full sm:w-[520px] bg-glomalin-surface border-l border-glomalin-border overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-glomalin-border bg-glomalin-surface">
              <div>
                <h2 className="font-mono text-glomalin-text font-semibold text-sm tracking-wide">
                  {editDelivery ? 'Edit Delivery' : 'Log Delivery'}
                </h2>
                {editDelivery && (
                  <p className="font-mono text-[10px] text-glomalin-muted/70 uppercase tracking-widest mt-0.5">
                    {editDelivery.customer?.name ?? ''} · {editDelivery.variant?.name ?? ''}
                  </p>
                )}
              </div>
              <button
                onClick={handleClose}
                className="w-7 h-7 flex items-center justify-center rounded text-glomalin-muted hover:text-glomalin-text hover:bg-glomalin-elevated font-mono text-base leading-none transition-colors"
                aria-label="Close drawer"
              >
                ×
              </button>
            </div>
            <div className="px-5 py-4">
              <DeliveryForm
                delivery={editDelivery}
                customers={customers}
                variants={variants}
                onSuccess={handleSaved}
                open={drawerOpen}
                onDirtyChange={(dirty) => { formIsDirtyRef.current = dirty }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
