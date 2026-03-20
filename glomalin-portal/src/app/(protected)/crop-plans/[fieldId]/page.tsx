'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/browser'
import OfflineBanner from '@/components/pwa/offline-banner'
import { syncCropPlanDetail, getCachedCropPlan } from '@/lib/offline/crop-plan-sync'
import type { CachedCropPlan } from '@/lib/offline/types'

// ─── inline SVG icons ─────────────────────────────────────────────────────────

function ArrowLeftIcon() {
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
      aria-hidden="true"
    >
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function CircleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
    </svg>
  )
}

// ─── skeleton ─────────────────────────────────────────────────────────────────

function SkeletonDetail() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-6 w-48 rounded bg-gray-200" />
      <div className="h-4 w-32 rounded bg-gray-100" />
      <div className="mt-6 space-y-2">
        <div className="h-4 w-full rounded bg-gray-100" />
        <div className="h-4 w-3/4 rounded bg-gray-100" />
        <div className="h-4 w-2/3 rounded bg-gray-100" />
      </div>
      <div className="mt-6 space-y-2">
        <div className="h-4 w-full rounded bg-gray-100" />
        <div className="h-4 w-5/6 rounded bg-gray-100" />
      </div>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function CropPlanDetailPage() {
  const params = useParams()
  const fieldId = typeof params?.fieldId === 'string' ? params.fieldId : ''

  const [plan, setPlan] = useState<CachedCropPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!fieldId) return

    async function loadPlan() {
      setLoading(true)
      setError(null)

      try {
        const supabase = createClient()
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.access_token

        if (token && navigator.onLine) {
          try {
            const data = await syncCropPlanDetail(token, fieldId)
            setPlan(data)
          } catch {
            // sync failed — fall back to cache
            const cached = await getCachedCropPlan(fieldId)
            if (cached) {
              setPlan(cached)
            } else {
              setError('Unable to load field data.')
            }
          }
        } else {
          // offline
          const cached = await getCachedCropPlan(fieldId)
          if (cached) {
            setPlan(cached)
          } else {
            setError('Field not found in offline cache.')
          }
        }
      } catch {
        setError('Unable to load field data.')
      } finally {
        setLoading(false)
      }
    }

    loadPlan()
  }, [fieldId])

  // ── render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div>
        <Link
          href="/crop-plans"
          className="mb-4 flex min-h-[48px] min-w-[48px] items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon />
          Back
        </Link>
        <SkeletonDetail />
      </div>
    )
  }

  if (error || !plan) {
    return (
      <div>
        <Link
          href="/crop-plans"
          className="mb-4 flex min-h-[48px] min-w-[48px] items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon />
          Back
        </Link>
        <p className="text-center text-sm text-red-600">{error ?? 'Field not found'}</p>
        <div className="mt-4 text-center">
          <Link href="/crop-plans" className="text-sm underline">
            Return to field list
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Back navigation */}
      <Link
        href="/crop-plans"
        className="mb-4 flex min-h-[48px] min-w-[48px] items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon />
        Back
      </Link>

      {/* Page title */}
      <div className="mb-4">
        <h1 className="text-xl font-bold">{plan.fieldName}</h1>
        <p className="text-sm text-muted-foreground">
          {plan.enterprise}
          {plan.acres > 0 ? ` · ${plan.acres} ac` : ''}
        </p>
      </div>

      {/* Offline banner */}
      <OfflineBanner />

      {/* ── Crop Info ─────────────────────────────────────────────────────────── */}
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex items-baseline gap-2">
          <span className="text-sm text-muted-foreground">Crop</span>
          <span className="text-lg font-semibold">{plan.crop}</span>
        </div>
        <dl className="space-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Variety:</dt>
            <dd>{plan.variety ?? <span className="italic text-muted-foreground">Not specified</span>}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Population:</dt>
            <dd>
              {/* CachedCropPlan doesn't have population — show "Not specified" */}
              <span className="italic text-muted-foreground">Not specified</span>
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Seed Treatment:</dt>
            <dd>
              <span className="italic text-muted-foreground">None</span>
            </dd>
          </div>
        </dl>
      </div>

      {/* ── Inputs ───────────────────────────────────────────────────────────── */}
      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">Inputs</h2>
        {plan.inputs.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">No inputs planned</p>
        ) : (
          <div className="divide-y rounded-lg border bg-card">
            {plan.inputs.map((input, i) => {
              const rateNum = parseFloat(input.rate)
              const total =
                !isNaN(rateNum) && plan.acres > 0
                  ? (rateNum * plan.acres).toFixed(1)
                  : null

              return (
                <div key={i} className="flex items-start justify-between p-4">
                  <div>
                    <p className="font-medium">{input.product}</p>
                    {total && (
                      <p className="text-xs text-muted-foreground">
                        Total: {total} {input.unit}
                      </p>
                    )}
                  </div>
                  <p className="ml-4 shrink-0 text-sm text-muted-foreground">
                    {input.rate} {input.unit}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Passes ───────────────────────────────────────────────────────────── */}
      <div className="mt-6 pb-8">
        <h2 className="mb-3 text-lg font-semibold">Passes</h2>
        {plan.passes.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">No passes planned</p>
        ) : (
          <div className="divide-y rounded-lg border bg-card">
            {plan.passes.map((pass, i) => {
              const isConfirmed = pass.status === 'CONFIRMED'
              return (
                <div key={pass.id ?? i} className="flex min-h-[48px] items-start justify-between p-4">
                  <div>
                    <p className="font-medium">{pass.type}</p>
                    <p className="text-sm text-muted-foreground">Pass #{pass.passNumber ?? i + 1}</p>
                    {isConfirmed && (pass.operationDate || pass.operatorName) && (
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {pass.operationDate}
                        {pass.operationDate && pass.operatorName ? ' · ' : ''}
                        {pass.operatorName}
                      </p>
                    )}
                  </div>
                  <div className="ml-4 shrink-0">
                    {isConfirmed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">
                        <CheckIcon />
                        Confirmed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                        <CircleIcon />
                        Planned
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
