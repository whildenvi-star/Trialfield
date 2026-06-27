'use client'

import {
  useSortState,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
  SortableHeader,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Empty } from '@/components/ui/empty'
import { Money } from '@/components/ui/money'
import { formatBu, formatBasis } from '@/lib/fmt'
import { DeliveryProgressBar } from './delivery-progress-bar'

interface GrainContractRow {
  id: string
  instrument:
    | 'PRICED'
    | 'SPOT'
    | 'FOB'
    | 'PRICED_LATER'
    | 'BASIS_FIXED'
    | 'FUTURES_FIXED'
    | 'MIN_PRICE'
    | 'ACCUMULATOR'
  contractedBushels: number
  appliedBushels: number
  futuresPrice?: number | null
  basis?: number | null
  finalCashPrice?: number | null
  cropYear: number
  deliveryStart?: string | null
  deliveryEnd?: string | null
  customer: { id: string; name: string; shortCode: string }
  variant: { id: string; name: string }
  status: 'OPEN' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED' | 'EXPIRED'
}

const INSTRUMENT_BADGE: Record<
  GrainContractRow['instrument'],
  { label: string; variant: 'default' | 'accent' | 'success' | 'warning' | 'info' }
> = {
  PRICED:       { label: 'PRICED',  variant: 'accent' },
  SPOT:         { label: 'SPOT',    variant: 'default' },
  FOB:          { label: 'FOB',     variant: 'default' },
  PRICED_LATER: { label: 'PTF',     variant: 'warning' },
  BASIS_FIXED:  { label: 'BASIS',   variant: 'info' },
  FUTURES_FIXED:{ label: 'HTA',     variant: 'info' },
  MIN_PRICE:    { label: 'MIN',     variant: 'success' },
  ACCUMULATOR:  { label: 'ACCUM',   variant: 'warning' },
}

const EM_DASH = '—'
const EDIT_PENCIL = '✎'

interface ContractTableProps {
  contracts: GrainContractRow[]
  role: 'owner' | 'office'
  cropYear: number
}

export function ContractTable({ contracts, role, cropYear }: ContractTableProps) {
  const { sortKey, sortDir, onSort } = useSortState('deliveryStart')

  const sortedContracts = [...contracts].sort((a, b) => {
    if (!sortKey || !sortDir) return 0

    let av: string | number | null = null
    let bv: string | number | null = null

    switch (sortKey) {
      case 'customer':
        av = a.customer.name
        bv = b.customer.name
        break
      case 'variant':
        av = a.variant.name
        bv = b.variant.name
        break
      case 'instrument':
        av = a.instrument
        bv = b.instrument
        break
      case 'contractedBushels':
        av = a.contractedBushels
        bv = b.contractedBushels
        break
      case 'deliveryStart':
        av = a.deliveryStart ?? null
        bv = b.deliveryStart ?? null
        break
      case 'futuresPrice':
        av = a.futuresPrice ?? null
        bv = b.futuresPrice ?? null
        break
      case 'basis':
        av = a.basis ?? null
        bv = b.basis ?? null
        break
      case 'finalCashPrice':
        av = a.finalCashPrice ?? null
        bv = b.finalCashPrice ?? null
        break
    }

    // Nulls last
    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1

    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortDir === 'asc' ? cmp : -cmp
  })

  return (
    <div className="overflow-x-auto rounded border border-glomalin-border">
      <Table>
        <TableHead>
          <TableRow hover={false}>
            <SortableHeader sortKey="customer" currentKey={sortKey} direction={sortDir} onSort={onSort}>
              CUSTOMER
            </SortableHeader>
            <SortableHeader sortKey="variant" currentKey={sortKey} direction={sortDir} onSort={onSort}>
              VARIANT
            </SortableHeader>
            <SortableHeader sortKey="instrument" currentKey={sortKey} direction={sortDir} onSort={onSort}>
              TYPE
            </SortableHeader>
            <SortableHeader sortKey="contractedBushels" currentKey={sortKey} direction={sortDir} onSort={onSort}>
              CONTRACTED
            </SortableHeader>
            <TableHeader>DELIVERY</TableHeader>
            <SortableHeader sortKey="futuresPrice" currentKey={sortKey} direction={sortDir} onSort={onSort}>
              FUTURES
            </SortableHeader>
            <SortableHeader sortKey="basis" currentKey={sortKey} direction={sortDir} onSort={onSort}>
              BASIS
            </SortableHeader>
            <SortableHeader sortKey="finalCashPrice" currentKey={sortKey} direction={sortDir} onSort={onSort}>
              CASH
            </SortableHeader>
            <TableHeader></TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {contracts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9}>
                <Empty
                  title={`No contracts for ${cropYear}`}
                  description="Contracts added in Phase 13 will appear here."
                />
              </TableCell>
            </TableRow>
          ) : (
            sortedContracts.map((contract) => {
              const badge = INSTRUMENT_BADGE[contract.instrument]
              return (
                <TableRow key={contract.id}>
                  <TableCell>{contract.customer.name}</TableCell>
                  <TableCell>{contract.variant.name}</TableCell>
                  <TableCell>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-mono">{formatBu(contract.contractedBushels)}</span>
                  </TableCell>
                  <TableCell>
                    <DeliveryProgressBar
                      applied={contract.appliedBushels}
                      contracted={contract.contractedBushels}
                    />
                  </TableCell>
                  <TableCell>
                    {'futuresPrice' in contract && contract.futuresPrice != null ? (
                      <Money value={contract.futuresPrice} cents />
                    ) : (
                      <span className="text-glomalin-muted">{EM_DASH}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {'basis' in contract && contract.basis != null ? (
                      formatBasis(contract.basis / 100)
                    ) : (
                      <span className="text-glomalin-muted">{EM_DASH}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {'finalCashPrice' in contract && contract.finalCashPrice != null ? (
                      <Money value={contract.finalCashPrice} cents />
                    ) : (
                      <span className="text-glomalin-muted">{EM_DASH}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <a
                      href={`/app/marketing/contracts/${contract.id}/edit`}
                      aria-label="Edit contract"
                      className="text-glomalin-muted hover:text-glomalin-accent transition-colors"
                    >
                      {EDIT_PENCIL}
                    </a>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
