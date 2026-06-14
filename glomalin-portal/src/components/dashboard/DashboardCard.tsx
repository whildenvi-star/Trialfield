'use client'

import Link from 'next/link'
import React from 'react'

type Category = 'field' | 'ops' | 'finance' | 'inputs'

const MODULE_CATEGORY: Record<string, Category> = {
  maps: 'field', weather: 'field', 'field-history': 'field', 'field-timeline': 'field',
  'field-ops': 'ops', compliance: 'ops', 'org-cert': 'ops', 'farm-registry': 'ops',
  performance: 'finance', 'enterprise-summary': 'finance', 'farm-budget': 'finance', 'grain-tickets': 'finance',
  'seed-inventory': 'inputs', 'meristem-malt': 'inputs',
}

function CategoryIcon({ cat }: { cat: Category }) {
  const base = 'w-5 h-5 text-glomalin-accent flex-shrink-0'
  if (cat === 'field') return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={base} aria-hidden="true">
      <rect x="1" y="1" width="6" height="6" rx="1" /><rect x="9" y="1" width="6" height="6" rx="1" />
      <rect x="1" y="9" width="6" height="6" rx="1" /><rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  )
  if (cat === 'ops') return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={base} aria-hidden="true">
      <rect x="4" y="1" width="8" height="14" rx="1" /><path d="M6 1v1a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V1" />
      <path d="M6 7h4M6 10h3" />
    </svg>
  )
  if (cat === 'finance') return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={base} aria-hidden="true">
      <path d="M2 12V8M6 12V5M10 12V7M14 12V3" />
    </svg>
  )
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={base} aria-hidden="true">
      <path d="M8 2v4M8 2C6 2 4 4 4 6c0 2 1.5 3 4 4s4 2 4 4c0 2-2 4-4 4" />
      <path d="M8 14v-4" />
    </svg>
  )
}

interface DashboardCardProps {
  moduleId: string
  moduleName: string
  href: string
  subtitle?: string
  children?: React.ReactNode
}

export function DashboardCard({ moduleId, moduleName, href, subtitle, children }: DashboardCardProps) {
  const cat = MODULE_CATEGORY[moduleId] ?? 'field'
  return (
    <Link href={href} className="block group">
      <div className="h-full bg-glomalin-surface border border-glomalin-border rounded-lg p-4 flex flex-col gap-3 transition-colors group-hover:border-glomalin-accent/40 group-hover:bg-glomalin-highlight/30">
        <CategoryIcon cat={cat} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono font-semibold text-glomalin-text leading-snug">{moduleName}</p>
          {subtitle && (
            <p className="text-[11px] font-mono text-glomalin-muted mt-1 leading-snug">{subtitle}</p>
          )}
        </div>
        {children && <div>{children}</div>}
      </div>
    </Link>
  )
}
