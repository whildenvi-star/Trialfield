'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import OfflineBanner from '@/components/pwa/offline-banner'
import {
  syncCropPlans,
  getCachedCropPlans,
  getLastSyncTime,
  type CropPlanListItem,
} from '@/lib/offline/crop-plan-sync'

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(isoString: string): string {
  const now = Date.now()
  const then = new Date(isoString).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin} min ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  const diffD = Math.floor(diffH / 24)
  return `${diffD}d ago`
}

function getSyncBadgeClass(isoString: string | null): string {
  if (!isoString) return 'text-muted-foreground'
  const diffH = (Date.now() - new Date(isoString).getTime()) / 3_600_000
  if (diffH > 48) return 'text-red-600'
  if (diffH > 24) return 'text-amber-600'
  return 'text-muted-foreground'
}

// ─── inline SVG icons ─────────────────────────────────────────────────────────

function RefreshCwIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={spinning ? 'animate-spin' : ''}
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  )
}

// ─── skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCards() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-lg border bg-gray-100 p-4"
          style={{ minHeight: 72 }}
        />
      ))}
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function CropPlansPage() {
  const router = useRouter()
  const [fields, setFields] = useState<CropPlanListItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [lastSynced, setLastSynced] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // pull-to-refresh tracking
  const touchStartY = useRef<number | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // ── sync function ────────────────────────────────────────────────────────────
  async function doSync() {
    setSyncing(true)
    setError(null)
    try {
      const supabase = createClient()
      // Validate session is active before using the token (getSession alone returns stale tokens)
      const { data: { user } } = await supabase.auth.getUser()
      const token = user ? (await supabase.auth.getSession()).data.session?.access_token : null

      if (token && navigator.onLine) {
        const result = await syncCropPlans(token)
        setFields(result.fields)
        setLastSynced(result.syncTimestamp)
      } else {
        // offline fallback
        const cached = await getCachedCropPlans()
        setFields(
          cached.map((c) => ({
            fieldId: c.fieldId,
            fieldName: c.fieldName,
            crop: c.crop,
            variety: c.variety ?? '',
            acres: c.acres,
            enterprise: c.enterprise ?? 'Unassigned',
            enterpriseId: '',
          }))
        )
        const lt = await getLastSyncTime()
        setLastSynced(lt)
      }
    } catch {
      // sync failed — fall back to cache
      try {
        const cached = await getCachedCropPlans()
        setFields(
          cached.map((c) => ({
            fieldId: c.fieldId,
            fieldName: c.fieldName,
            crop: c.crop,
            variety: c.variety ?? '',
            acres: c.acres,
            enterprise: c.enterprise ?? 'Unassigned',
            enterpriseId: '',
          }))
        )
        const lt = await getLastSyncTime()
        setLastSynced(lt)
      } catch {
        setError('Unable to load field data.')
      }
    } finally {
      setSyncing(false)
      setLoading(false)
    }
  }

  // ── mount ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Online/offline listeners
    setIsOnline(navigator.onLine)
    function handleOnline() { setIsOnline(true) }
    function handleOffline() { setIsOnline(false) }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Restore scroll position
    const saved = sessionStorage.getItem('cropPlanScrollY')
    if (saved) {
      window.scrollTo(0, parseInt(saved, 10))
    }

    // Save scroll on navigate away
    function saveScroll() {
      sessionStorage.setItem('cropPlanScrollY', String(window.scrollY))
    }
    window.addEventListener('beforeunload', saveScroll)

    // Load last sync time then do initial sync
    getLastSyncTime().then((lt) => setLastSynced(lt))
    doSync()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('beforeunload', saveScroll)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── derived state ─────────────────────────────────────────────────────────────
  const filteredFields = useMemo(
    () =>
      fields.filter((f) =>
        f.fieldName.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [fields, searchQuery]
  )

  const groupedFields = useMemo(() => {
    const groups: Record<string, CropPlanListItem[]> = {}
    for (const f of filteredFields) {
      const key = f.enterprise || 'Unassigned'
      if (!groups[key]) groups[key] = []
      groups[key].push(f)
    }
    return groups
  }, [filteredFields])

  const sortedEnterpriseKeys = useMemo(
    () => Object.keys(groupedFields).sort((a, b) => a.localeCompare(b)),
    [groupedFields]
  )

  // ── pull-to-refresh ───────────────────────────────────────────────────────────
  function handleTouchStart(e: React.TouchEvent) {
    if (window.scrollY === 0) {
      touchStartY.current = e.touches[0].clientY
    }
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartY.current === null) return
    const delta = e.touches[0].clientY - touchStartY.current
    if (delta > 60 && !syncing) {
      touchStartY.current = null
      doSync()
    }
  }
  function handleTouchEnd() {
    touchStartY.current = null
  }

  // ── render ────────────────────────────────────────────────────────────────────
  return (
    <div
      ref={scrollContainerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Crop Plans</h1>
        <button
          onClick={() => doSync()}
          disabled={syncing}
          aria-label="Sync crop plans"
          className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/50 disabled:opacity-50"
        >
          <RefreshCwIcon spinning={syncing} />
        </button>
      </div>

      {/* Offline banner */}
      <OfflineBanner />

      {/* Last synced badge */}
      {lastSynced && (
        <p className={`mb-3 text-sm ${getSyncBadgeClass(lastSynced)}`}>
          Last synced: {formatRelativeTime(lastSynced)}
        </p>
      )}

      {/* Search */}
      <input
        type="search"
        placeholder="Search fields..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="mb-6 w-full min-h-[48px] rounded-md border border-input bg-background px-4 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />

      {/* Loading state */}
      {loading && <SkeletonCards />}

      {/* Error state */}
      {!loading && error && (
        <p className="text-center text-sm text-red-600">{error}</p>
      )}

      {/* Empty state */}
      {!loading && !error && filteredFields.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">No fields found</p>
      )}

      {/* Enterprise-grouped field list */}
      {!loading && !error && sortedEnterpriseKeys.map((enterprise) => (
        <section key={enterprise} className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">{enterprise}</h2>
          <div className="space-y-3">
            {groupedFields[enterprise].map((field) => (
              <div
                key={field.fieldId}
                role="button"
                tabIndex={0}
                onClick={() => {
                  sessionStorage.setItem('cropPlanScrollY', String(window.scrollY))
                  router.push(`/crop-plans/${field.fieldId}`)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    sessionStorage.setItem('cropPlanScrollY', String(window.scrollY))
                    router.push(`/crop-plans/${field.fieldId}`)
                  }
                }}
                className="flex min-h-[72px] cursor-pointer items-center justify-between rounded-lg border bg-card p-4 shadow-sm hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <div>
                  <p className="font-medium">{field.fieldName}</p>
                  <p className="text-sm text-muted-foreground">
                    {field.crop}
                    {field.variety ? ` — ${field.variety}` : ''}
                  </p>
                </div>
                <p className="ml-4 shrink-0 text-sm text-muted-foreground">
                  {field.acres > 0 ? `${field.acres} ac` : ''}
                </p>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* Online status indicator for dev */}
      {!isOnline && null /* OfflineBanner handles this */}
    </div>
  )
}
