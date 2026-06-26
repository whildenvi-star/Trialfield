'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { label: 'Overview',     href: '/app/marketing',              stub: false },
  { label: 'Customers',    href: '/app/marketing/customers',    stub: false },
  { label: 'Basis Quotes', href: '/app/marketing/basis-quotes', stub: false },
  { label: 'Contracts',    href: '/app/marketing/contracts',    stub: true  },
  { label: 'Deliveries',   href: '/app/marketing/deliveries',   stub: true  },
]

export function MarketingNav() {
  const pathname = usePathname()

  return (
    <nav className="w-44 shrink-0 border-r border-glomalin-border py-4 px-2 flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === '/app/marketing'
          ? pathname === '/app/marketing'
          : pathname.startsWith(item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'px-3 py-2 rounded text-sm font-mono transition-colors',
              isActive
                ? 'bg-glomalin-elevated text-glomalin-accent'
                : 'text-glomalin-muted hover:text-glomalin-text hover:bg-glomalin-elevated/50',
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
