'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { useSyncStatus } from '@/hooks/useSyncStatus'
import { SyncStatusBanner } from './sync-status-banner'

export function SyncStatusProvider() {
  const [mounted, setMounted] = useState(false)
  const [showSyncMessage, setShowSyncMessage] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Create Supabase browser client once (stable reference across renders)
  const supabaseRef = useRef(createClient())

  // Token getter: validates session is active before returning token
  // (getSession alone returns stale tokens — validate with getUser first)
  async function getToken(): Promise<string | null> {
    const supabase = supabaseRef.current
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }

  const { isOnline, pendingCount, syncState, errorMessage, drainQueue } =
    useSyncStatus(getToken)

  // Mounted guard — prevents SSR hydration mismatch on navigator.onLine
  useEffect(() => {
    setMounted(true)
  }, [])

  // Auto-dismiss "Synced X items" toast after successful drain
  useEffect(() => {
    function handleSyncCompleted(e: Event) {
      const customEvent = e as CustomEvent<{ count: number }>
      const count = customEvent.detail?.count ?? 0
      const msg = `Synced ${count} item${count !== 1 ? 's' : ''}`
      setSyncMessage(msg)
      setShowSyncMessage(true)

      // Clear any existing timer before setting a new one
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      toastTimerRef.current = setTimeout(() => {
        setShowSyncMessage(false)
      }, 3000)
    }

    window.addEventListener('sync:completed', handleSyncCompleted)

    return () => {
      window.removeEventListener('sync:completed', handleSyncCompleted)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  return (
    <>
      {mounted && (
        <SyncStatusBanner
          isOnline={isOnline}
          pendingCount={pendingCount}
          syncState={syncState}
          errorMessage={errorMessage}
          onRetry={drainQueue}
        />
      )}
      {showSyncMessage && (
        <div
          role="status"
          aria-live="polite"
          className="w-full px-4 py-2 text-xs font-mono text-center bg-glomalin-success/10 text-glomalin-success border-b border-glomalin-success/20"
        >
          {syncMessage}
        </div>
      )}
    </>
  )
}
