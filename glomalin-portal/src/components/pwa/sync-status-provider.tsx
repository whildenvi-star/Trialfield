'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { useSyncStatus } from '@/hooks/useSyncStatus'
import { SyncStatusBanner } from './sync-status-banner'

export function SyncStatusProvider() {
  const [mounted, setMounted] = useState(false)

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

  const { isOnline, pendingCount, syncState, syncDone, syncTotal, errorMessage, drainQueue } =
    useSyncStatus(getToken)

  // Mounted guard — prevents SSR hydration mismatch on navigator.onLine
  useEffect(() => {
    setMounted(true)
  }, [])

  // The banner's transient 'synced' state is the single confirmation surface;
  // the old separate "Synced X items" toast stacked a second green bar on it.
  if (!mounted) return null

  return (
    <SyncStatusBanner
      isOnline={isOnline}
      pendingCount={pendingCount}
      syncState={syncState}
      syncDone={syncDone}
      syncTotal={syncTotal}
      errorMessage={errorMessage}
      onRetry={drainQueue}
    />
  )
}
