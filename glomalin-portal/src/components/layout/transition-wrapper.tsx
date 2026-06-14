'use client'

import { usePathname } from 'next/navigation'

export function TransitionWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div key={pathname} className="animate-page-enter">
      {children}
    </div>
  )
}
