'use client'

import Link from 'next/link'
import React from 'react'

function ChevronRightIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4 text-glomalin-muted"
      aria-hidden="true"
    >
      <path d="M6 4l4 4-4 4" />
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

export function DashboardCard({ moduleId: _moduleId, moduleName, href, subtitle, children }: DashboardCardProps) {
  return (
    <Link href={href} className="block">
      <div className="bg-glomalin-surface border border-glomalin-border rounded p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-mono text-glomalin-text font-semibold">{moduleName}</span>
          <ChevronRightIcon />
        </div>
        {subtitle && (
          <div className="text-xs font-mono text-glomalin-muted">{subtitle}</div>
        )}
        {children && <div className="mt-2">{children}</div>}
      </div>
    </Link>
  )
}
