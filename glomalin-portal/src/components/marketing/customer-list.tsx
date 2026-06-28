'use client'

import { useState } from 'react'
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
import { CustomerForm } from '@/components/marketing/customer-form'

// Customer type mirroring the organic-cert API response shape
type Customer = {
  id: string
  name: string
  type: string
  shortCode?: string | null
  contactName?: string | null
  phone?: string | null
  email?: string | null
  organicCertNum?: string | null
  notes?: string | null
  farmId?: string
}

interface CustomerListClientProps {
  customers: Customer[]
  role: 'owner' | 'office'
}

const TYPE_LABELS: Record<string, string> = {
  ELEVATOR: 'Elevator',
  CO_OP: 'Co-op',
  SPECIALTY: 'Specialty',
  END_USER: 'End User',
  MALTSTER: 'Maltster',
}

function CustomerTypeBadge({ type }: { type: string }) {
  const label = TYPE_LABELS[type] ?? type
  const isSpecialty = type === 'SPECIALTY'
  const badgeClass = isSpecialty
    ? 'inline-block font-mono text-xs px-1.5 py-0.5 rounded border border-glomalin-accent/50 text-glomalin-accent bg-glomalin-accent/10'
    : 'inline-block font-mono text-xs px-1.5 py-0.5 rounded border border-glomalin-border text-glomalin-muted bg-glomalin-bg'
  return <span className={badgeClass}>{label}</span>
}

export function CustomerListClient({ customers, role }: CustomerListClientProps) {
  const router = useRouter()
  const { sortKey, sortDir, onSort } = useSortState('name')
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Sort customers; list is refreshed server-side via router.refresh() after save
  const sorted = [...customers].sort((a, b) => {
    if (!sortKey || !sortDir) return 0
    const av = (a[sortKey as keyof Customer] as string | null) ?? ''
    const bv = (b[sortKey as keyof Customer] as string | null) ?? ''
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortDir === 'asc' ? cmp : -cmp
  })

  function openCreate() {
    setEditCustomer(null)
    setDrawerOpen(true)
  }

  function openEdit(c: Customer) {
    setEditCustomer(c)
    setDrawerOpen(true)
  }

  function handleClose() {
    setDrawerOpen(false)
  }

  function handleSaved() {
    setDrawerOpen(false)
    router.refresh()
  }

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h1 className="font-heading text-lg font-semibold text-glomalin-text">Customers</h1>
        <button
          onClick={openCreate}
          className="bg-glomalin-accent text-glomalin-bg font-mono font-semibold text-sm rounded px-4 py-2 hover:opacity-90 transition-opacity"
        >
          Add Customer
        </button>
      </div>

      {/* Table or empty state */}
      {sorted.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-2">
          <p className="text-glomalin-muted font-mono text-sm">No customers yet.</p>
          <p className="text-glomalin-muted font-sans text-sm">Add your first customer to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-glomalin-border">
          <Table>
            <TableHead>
              <TableRow hover={false}>
                <SortableHeader
                  sortKey="name"
                  currentKey={sortKey}
                  direction={sortDir}
                  onSort={onSort}
                >
                  NAME
                </SortableHeader>
                <TableHeader>SHORT CODE</TableHeader>
                <TableHeader>TYPE</TableHeader>
                <TableHeader>CONTACT</TableHeader>
                <TableHeader className="text-right">ACTIONS</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-glomalin-elevated/50 transition-colors"
                  onClick={() => openEdit(c)}
                >
                  <TableCell className="text-glomalin-text font-sans text-sm">{c.name}</TableCell>
                  <TableCell className="font-mono text-sm text-glomalin-muted">
                    {c.shortCode ?? '—'}
                  </TableCell>
                  <TableCell>
                    <CustomerTypeBadge type={c.type} />
                  </TableCell>
                  <TableCell className="text-glomalin-text text-sm">
                    {c.contactName ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      aria-label={`Edit customer ${c.name}`}
                      className="text-glomalin-accent font-mono text-xs hover:opacity-80 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation()
                        openEdit(c)
                      }}
                    >
                      Edit
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* CustomerForm drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60"
            onClick={handleClose}
          />
          {/* Panel */}
          <div className="fixed right-0 top-0 h-full w-[480px] bg-glomalin-surface border-l border-glomalin-border overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-glomalin-border">
              <h2 className="font-mono text-glomalin-text font-semibold">
                {editCustomer ? 'Edit Customer' : 'New Customer'}
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
              <CustomerForm
                customer={editCustomer}
                onSuccess={handleSaved}
                open={drawerOpen}
                onClose={handleClose}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
