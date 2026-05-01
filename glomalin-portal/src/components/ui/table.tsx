'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

// ── Core table primitives ────────────────────────────────────────────────────

function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full text-sm', className)} {...props} />
    </div>
  )
}

function TableHead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('', className)} {...props} />
}

function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-glomalin-border/50', className)} {...props} />
}

function TableFoot({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot
      className={cn('border-t border-glomalin-border-strong font-semibold', className)}
      {...props}
    />
  )
}

function TableRow({
  className,
  hover = true,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { hover?: boolean }) {
  return (
    <tr
      className={cn(
        hover && 'hover:bg-glomalin-elevated/50 transition-colors',
        className
      )}
      {...props}
    />
  )
}

function TableHeader({
  className,
  sticky = false,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { sticky?: boolean }) {
  return (
    <th
      className={cn(
        'px-3 py-2 text-left font-mono text-xs uppercase tracking-wider text-glomalin-muted',
        'border-b border-glomalin-border',
        sticky && 'sticky top-0 bg-glomalin-surface z-10',
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn('px-3 py-2 text-glomalin-text', className)}
      {...props}
    />
  )
}

// ── Sortable header ──────────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc' | null

interface SortableHeaderProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortKey: string
  currentKey: string | null
  direction: SortDir
  onSort: (key: string) => void
  sticky?: boolean
}

function SortableHeader({
  sortKey,
  currentKey,
  direction,
  onSort,
  className,
  sticky = false,
  children,
  ...props
}: SortableHeaderProps) {
  const isActive = currentKey === sortKey
  return (
    <th
      className={cn(
        'px-3 py-2 text-left font-mono text-xs uppercase tracking-wider',
        'border-b border-glomalin-border cursor-pointer select-none',
        'hover:text-glomalin-text transition-colors',
        isActive ? 'text-glomalin-accent' : 'text-glomalin-muted',
        sticky && 'sticky top-0 bg-glomalin-surface z-10',
        className
      )}
      onClick={() => onSort(sortKey)}
      {...props}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <span className="opacity-60">
          {isActive && direction === 'asc' ? '↑' : isActive && direction === 'desc' ? '↓' : '↕'}
        </span>
      </span>
    </th>
  )
}

// ── useSortState helper ──────────────────────────────────────────────────────

export function useSortState(initial?: string) {
  const [sortKey, setSortKey] = useState<string | null>(initial ?? null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function onSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc'))
      if (sortDir === 'desc') setSortKey(null)
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function sortRows<T>(rows: T[], accessor: (row: T) => number | string | null): T[] {
    if (!sortKey || !sortDir) return rows
    return [...rows].sort((a, b) => {
      const av = accessor(a) ?? ''
      const bv = accessor(b) ?? ''
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }

  return { sortKey, sortDir, onSort, sortRows }
}

export {
  Table,
  TableHead,
  TableBody,
  TableFoot,
  TableRow,
  TableHeader,
  TableCell,
  SortableHeader,
}
