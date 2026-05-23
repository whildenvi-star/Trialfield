'use client'

import { useState, useEffect } from 'react'
import { cropPlanCache } from '@/lib/offline/db'
import { syncCropPlans } from '@/lib/offline/crop-plan-sync'
import { createClient } from '@/lib/supabase/browser'
import type { CachedCropPlan } from '@/lib/offline/types'

export interface DashboardData {
  plans: CachedCropPlan[]
  isLoading: boolean
  isOnline: boolean
  lastSyncAt: string | null
}

export function useDashboardData(): DashboardData {
  const [plans, setPlans] = useState<CachedCropPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(true) // SSR-safe default — corrected in useEffect
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)

  useEffect(() => {
    // Read navigator.onLine only inside useEffect — never at module scope (SSR crash)
    setIsOnline(navigator.onLine)

    async function loadData() {
      // Step 1: Read IDB cache — always fast (~1ms)
      const cached = await cropPlanCache.getAll()
      setPlans(cached)
      setIsLoading(false)

      // Step 2: Read last sync timestamp from IDB
      const lastSync = await cropPlanCache.getLastSyncTime()
      setLastSyncAt(lastSync)

      // Step 3: Background refresh if online
      if (!navigator.onLine) return

      try {
        const supabase = createClient()
        // Two-step auth pattern per RESEARCH.md Pitfall 6:
        // getUser() validates session with server, then getSession() for token
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) return

        const { fields } = await syncCropPlans(token)

        // Refresh plans from IDB after sync — IDB is the source of truth
        const refreshed = await cropPlanCache.getAll()
        setPlans(refreshed)

        // Update lastSyncAt from the freshest cachedAt
        if (fields.length > 0) {
          const freshSync = await cropPlanCache.getLastSyncTime()
          setLastSyncAt(freshSync)
        }
      } catch {
        // Background sync failures must never crash the hook — silent fail
      }
    }

    loadData()
  }, [])

  return { plans, isLoading, isOnline, lastSyncAt }
}
