'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

// Horizontal sub-tab strip — mirrors the macro-rollup Sales tab's mkt-tabs
// layout (underlined active tab) now that that tab has been retired and the
// command center is the single marketing surface.
const NAV_ITEMS = [
  { label: 'Dashboard',    href: '/app/marketing',              stub: false },
  { label: 'Contracts',    href: '/app/marketing/contracts',    stub: false },
  { label: 'Deliveries',   href: '/app/marketing/deliveries',   stub: false },
  { label: 'Basis Quotes', href: '/app/marketing/basis-quotes', stub: false },
  { label: 'Buyers',       href: '/app/marketing/customers',    stub: false },
]

export function MarketingNav() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 px-4 md:px-6 pt-3 border-b border-glomalin-border overflow-x-auto">
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === '/app/marketing'
          ? pathname === '/app/marketing'
          : pathname.startsWith(item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'px-3 py-2 text-sm font-mono whitespace-nowrap border-b-2 -mb-px transition-colors',
              isActive
                ? 'text-glomalin-accent border-glomalin-accent'
                : 'text-glomalin-muted border-transparent hover:text-glomalin-text',
              item.stub && 'opacity-50 pointer-events-none cursor-not-allowed',
            )}
            aria-disabled={item.stub ? true : undefined}
            tabIndex={item.stub ? -1 : undefined}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
