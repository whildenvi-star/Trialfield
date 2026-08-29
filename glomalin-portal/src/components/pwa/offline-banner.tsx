'use client'

import { useEffect, useState } from 'react'

export default function OfflineBanner() {
  const [mounted, setMounted] = useState(false)
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setMounted(true)
    setIsOnline(navigator.onLine)

    function handleOnline() {
      setIsOnline(true)
    }

    function handleOffline() {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Don't render on server or when online
  if (!mounted || isOnline) return null

  return (
    // Neutral, not warning-styled: offline is normal in the field, and the
    // data on screen is still useful — say what works, don't alarm
    <div
      role="status"
      aria-live="polite"
      className="w-full bg-glomalin-surface border-b border-glomalin-border px-4 py-2 text-center text-sm font-medium text-glomalin-muted"
    >
      Offline — showing saved data
    </div>
  )
}
