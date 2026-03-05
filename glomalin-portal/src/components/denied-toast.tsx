'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { MODULES } from '@/lib/modules'

export default function DeniedToast() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const denied = searchParams.get('denied')

  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)

  const moduleLabel = denied
    ? MODULES.find((m) => m.id === denied)?.label ?? denied
    : null

  useEffect(() => {
    if (!denied) return

    // Slight delay so opacity transition is visible
    setMounted(true)
    const showTimer = setTimeout(() => setVisible(true), 50)

    // Auto-dismiss after 5 seconds
    const dismissTimer = setTimeout(() => {
      setVisible(false)
    }, 5000)

    // Remove from DOM and clean URL after fade-out
    const cleanupTimer = setTimeout(() => {
      setMounted(false)
      router.replace('/dashboard', { scroll: false })
    }, 5600)

    return () => {
      clearTimeout(showTimer)
      clearTimeout(dismissTimer)
      clearTimeout(cleanupTimer)
    }
  }, [denied, router])

  if (!denied || !mounted) return null

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 max-w-sm transition-opacity duration-500 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="bg-soil-surface border border-soil-border rounded-lg shadow-xl p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <svg
              className="w-5 h-5 text-soil-accent"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
            </svg>
          </div>
          <div>
            <p className="text-soil-text text-sm font-mono">
              You don&apos;t have access to{' '}
              <span className="text-soil-accent font-bold">{moduleLabel}</span>.
            </p>
            <p className="text-soil-muted text-xs mt-1">
              Contact your administrator for access.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
