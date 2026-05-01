'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { InsurancePolicy, PricingEntry } from '@/lib/fsa/calc'
import { computePpIndemnity } from '@/lib/insurance/calc'
import { PolicyDrawer } from './policy-drawer'
import { AphPanel } from './aph-panel'
import { CoverageMatrix } from './coverage-matrix'
import { PayoutSimulator } from './payout-simulator'
import { PricingStalenessBadge } from './pricing-staleness-badge'
import { ProductionTracker } from './production-tracker'

// SSR-guarded PDF button — @react-pdf/renderer cannot run on the server
const InsurancePdfButton = dynamic(
  () => import('./insurance-pdf-button').then((m) => ({ default: m.InsurancePdfButton })),
  {
    ssr: false,
    loading: () => (
      <button disabled className="bg-glomalin-accent text-glomalin-bg px-4 py-2 rounded font-mono text-sm font-bold opacity-50 cursor-not-allowed">
        Loading...
      </button>
    ),
  }
)

interface PolicyFormData {
  farm_name: string
  farm_number: string
  crop: string
  plan_type: string
  coverage_level: number
  unit_type: string
  planted_acres: string
  guarantee: string
  actual: string
  premium_per_acre: string
  agent_name: string
  notes: string
  prevented_planting: boolean
  prevented_planting_acres: string
}

interface InsuranceWorkspaceProps {
  initialPolicies: InsurancePolicy[]
  initialPricing: PricingEntry[]
  lastScraped: string | null
}

export function InsuranceWorkspace({ initialPolicies, initialPricing, lastScraped }: InsuranceWorkspaceProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [policies, setPolicies] = useState<InsurancePolicy[]>(initialPolicies)
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create')
  const [editingPolicy, setEditingPolicy] = useState<InsurancePolicy | null>(null)
  // Sync Yield state
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [syncFeedback, setSyncFeedback] = useState<{ id: string; message: string; type: 'success' | 'error' } | null>(null)
  // File Claim modal state
  const [filingPolicy, setFilingPolicy] = useState<InsurancePolicy | null>(null)
  const [claimDate, setClaimDate] = useState('')
  const [claimDesc, setClaimDesc] = useState('')
  const [claimSubmitting, setClaimSubmitting] = useState(false)

  // Handle ?highlight= and ?action=create URL params on mount (cross-module navigation from CluCard)
  useEffect(() => {
    const highlight = searchParams.get('highlight')
    const action = searchParams.get('action')

    if (highlight) {
      setSelectedPolicyId(highlight)
    }

    if (action === 'create') {
      setEditingPolicy(null)
      setDrawerMode('create')
      setDrawerOpen(true)
    }
    // Only run on mount — searchParams reference is stable on first render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Stat card calculations
  const totalPolicies = policies.length
  const cropsInsured = new Set(
    policies.filter((p) => p.crop && p.crop.trim()).map((p) => p.crop!.trim().toLowerCase())
  ).size
  const claimAlerts = policies.filter((p) => p.claim_alert === 'potential').length

  // PP stat card — only computed when at least one policy has PP enabled
  const ppPolicies = policies.filter((p) => p.prevented_planting)
  const totalPpIndemnity = ppPolicies.reduce((sum, policy) => {
    const { ppIndemnity } = computePpIndemnity(
      { guarantee: policy.guarantee, prevented_planting_acres: policy.prevented_planting_acres },
      initialPricing,
      policy.crop
    )
    return sum + ppIndemnity
  }, 0)

  const selectedPolicy = policies.find((p) => p.id === selectedPolicyId) ?? null

  // CRUD handlers

  async function handleCreate(formData: PolicyFormData) {
    const body = {
      farm_name: formData.farm_name || null,
      farm_number: formData.farm_number || null,
      crop: formData.crop || null,
      plan_type: formData.plan_type || null,
      coverage_level: formData.coverage_level,
      unit_type: formData.unit_type || null,
      planted_acres: parseFloat(formData.planted_acres) || 0,
      guarantee: parseFloat(formData.guarantee) || 0,
      actual: parseFloat(formData.actual) || 0,
      premium_per_acre: formData.premium_per_acre ? parseFloat(formData.premium_per_acre) : null,
      agent_name: formData.agent_name || null,
      notes: formData.notes || null,
      prevented_planting: formData.prevented_planting,
      prevented_planting_acres: formData.prevented_planting_acres ? parseFloat(formData.prevented_planting_acres) : null,
    }

    try {
      const res = await fetch('/api/insurance/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('Failed to create policy:', err)
        return
      }

      const { policy } = await res.json()
      setPolicies((prev) => [...prev, policy as InsurancePolicy])
      setDrawerOpen(false)
    } catch (err) {
      console.error('Network error creating policy:', err)
    }
  }

  async function handleUpdate(id: string, formData: PolicyFormData) {
    const body = {
      farm_name: formData.farm_name || null,
      farm_number: formData.farm_number || null,
      crop: formData.crop || null,
      plan_type: formData.plan_type || null,
      coverage_level: formData.coverage_level,
      unit_type: formData.unit_type || null,
      planted_acres: parseFloat(formData.planted_acres) || 0,
      guarantee: parseFloat(formData.guarantee) || 0,
      actual: parseFloat(formData.actual) || 0,
      premium_per_acre: formData.premium_per_acre ? parseFloat(formData.premium_per_acre) : null,
      agent_name: formData.agent_name || null,
      notes: formData.notes || null,
      prevented_planting: formData.prevented_planting,
      prevented_planting_acres: formData.prevented_planting_acres ? parseFloat(formData.prevented_planting_acres) : null,
    }

    try {
      const res = await fetch(`/api/insurance/policies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('Failed to update policy:', err)
        return
      }

      const { policy } = await res.json()
      setPolicies((prev) => prev.map((p) => (p.id === id ? (policy as InsurancePolicy) : p)))
      setDrawerOpen(false)
    } catch (err) {
      console.error('Network error updating policy:', err)
    }
  }

  async function handleDelete(id: string) {
    const policy = policies.find((p) => p.id === id)
    const label = `${policy?.farm_name ?? '(no farm)'} / ${policy?.crop ?? 'no crop'}`
    if (!confirm(`Delete policy for ${label}?`)) return

    try {
      const res = await fetch(`/api/insurance/policies/${id}`, { method: 'DELETE' })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('Failed to delete policy:', err)
        return
      }

      setPolicies((prev) => prev.filter((p) => p.id !== id))
      if (selectedPolicyId === id) setSelectedPolicyId(null)
    } catch (err) {
      console.error('Network error deleting policy:', err)
    }
  }

  async function handleSyncYield(policyId: string) {
    setSyncingId(policyId)
    setSyncFeedback(null)
    try {
      const res = await fetch('/api/insurance/yield-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policyId }),
      })
      const data = await res.json()
      if (data.matched && data.policy) {
        // Full row replacement — data.policy includes actual_synced_from_grain and recomputed claim_alert
        setPolicies((prev) => prev.map((p) => (p.id === policyId ? data.policy : p)))
        setSyncFeedback({ id: policyId, message: 'Yield synced successfully', type: 'success' })
      } else {
        const msg = data.error || 'No grain ticket match found'
        setSyncFeedback({ id: policyId, message: msg, type: 'error' })
      }
    } catch {
      setSyncFeedback({ id: policyId, message: 'Network error', type: 'error' })
    } finally {
      setSyncingId(null)
      // Auto-clear feedback after 5 seconds
      setTimeout(() => setSyncFeedback((prev) => (prev?.id === policyId ? null : prev)), 5000)
    }
  }

  async function handleFileClaim() {
    if (!filingPolicy || !claimDate) return
    setClaimSubmitting(true)
    try {
      const res = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policy_id: filingPolicy.id,
          date_of_loss: claimDate,
          description: claimDesc || null,
        }),
      })
      if (res.ok) {
        setFilingPolicy(null)
        setClaimDate('')
        setClaimDesc('')
        router.push('/app/claims')
      } else {
        const err = await res.json().catch(() => ({}))
        console.error('Failed to create claim:', err)
      }
    } catch (err) {
      console.error('Network error filing claim:', err)
    } finally {
      setClaimSubmitting(false)
    }
  }

  function handleGuaranteeChange(newGuarantee: number) {
    if (!selectedPolicyId) return
    setPolicies((prev) =>
      prev.map((p) => (p.id === selectedPolicyId ? { ...p, guarantee: newGuarantee } : p))
    )
  }

  function openCreateDrawer() {
    setEditingPolicy(null)
    setDrawerMode('create')
    setDrawerOpen(true)
  }

  function openEditDrawer(policy: InsurancePolicy) {
    setEditingPolicy(policy)
    setDrawerMode('edit')
    setDrawerOpen(true)
  }

  function handleDrawerSave(formData: PolicyFormData) {
    if (drawerMode === 'edit' && editingPolicy) {
      handleUpdate(editingPolicy.id, formData)
    } else {
      handleCreate(formData)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Page header row */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-mono font-semibold text-glomalin-accent">Crop Insurance</h1>
          <p className="text-glomalin-muted text-sm mt-1">2026 policy year — decision support tool</p>
        </div>
        <div className="flex items-center gap-3">
          <InsurancePdfButton policies={policies} pricing={initialPricing} />
          <button
            onClick={openCreateDrawer}
            className="font-mono text-sm font-bold bg-glomalin-accent text-glomalin-bg rounded px-4 py-2 hover:opacity-90 transition-opacity"
          >
            Add Policy
          </button>
        </div>
      </div>

      {/* Pricing staleness indicator + refresh button */}
      <div className="mb-6">
        <PricingStalenessBadge lastScraped={lastScraped} />
      </div>

      {/* Stat cards */}
      <div className={`grid grid-cols-1 gap-4 mb-8 ${ppPolicies.length > 0 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
        <div className="rounded-lg border border-glomalin-border bg-glomalin-surface px-5 py-4">
          <p className="text-xs text-glomalin-muted uppercase tracking-wide font-mono mb-1">Policies</p>
          <p className="text-3xl font-mono font-bold text-glomalin-text">{totalPolicies}</p>
        </div>
        <div className="rounded-lg border border-glomalin-border bg-glomalin-surface px-5 py-4">
          <p className="text-xs text-glomalin-muted uppercase tracking-wide font-mono mb-1">Crops Insured</p>
          <p className="text-3xl font-mono font-bold text-glomalin-text">{cropsInsured}</p>
        </div>
        <div className="rounded-lg border border-glomalin-border bg-glomalin-surface px-5 py-4">
          <p className="text-xs text-glomalin-muted uppercase tracking-wide font-mono mb-1">Claim Alerts</p>
          <p className={`text-3xl font-mono font-bold ${claimAlerts > 0 ? 'text-yellow-400' : 'text-glomalin-text'}`}>
            {claimAlerts}
          </p>
        </div>
        {ppPolicies.length > 0 && (
          <div className="rounded-lg border border-amber-700/50 bg-amber-950/20 px-5 py-4">
            <p className="text-xs text-amber-400/80 uppercase tracking-wide font-mono mb-1">PP Indemnity</p>
            <p className="text-2xl font-mono font-bold text-amber-300">
              ${totalPpIndemnity.toLocaleString()}
            </p>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-glomalin-muted mb-6 italic">
        This is a decision-support tool, not an official insurance summary. Verify all figures
        with your insurance agent before making coverage decisions.
      </p>

      {/* Policy table */}
      {policies.length === 0 ? (
        <div className="rounded-lg border border-glomalin-border bg-glomalin-surface px-6 py-12 text-center">
          <p className="text-glomalin-muted text-sm">
            No insurance policies found for 2026. Click{' '}
            <button
              onClick={openCreateDrawer}
              className="text-glomalin-accent underline underline-offset-2"
            >
              Add Policy
            </button>{' '}
            to create one, or run{' '}
            <code className="text-glomalin-accent">npx tsx scripts/migrate-fsa.ts</code> to import
            existing data.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-glomalin-border overflow-hidden mb-8">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="bg-glomalin-surface border-b border-glomalin-border">
                <th className="px-4 py-3 text-left text-glomalin-accent font-semibold">Farm</th>
                <th className="px-4 py-3 text-left text-glomalin-accent font-semibold">Crop</th>
                <th className="px-4 py-3 text-left text-glomalin-accent font-semibold">Plan Type</th>
                <th className="px-4 py-3 text-right text-glomalin-accent font-semibold">Coverage</th>
                <th className="px-4 py-3 text-right text-glomalin-accent font-semibold">Guarantee (bu/ac)</th>
                <th className="px-4 py-3 text-right text-glomalin-accent font-semibold">Actual (bu/ac)</th>
                <th className="px-4 py-3 text-center text-glomalin-accent font-semibold">Alert</th>
                <th className="px-4 py-3 text-center text-glomalin-accent font-semibold">PP</th>
                <th className="px-4 py-3 text-center text-glomalin-accent font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((policy, idx) => {
                const hasVerifyNote = policy.notes && policy.notes.includes('VERIFY')
                const isAlternateRow = idx % 2 === 1
                const isSelected = selectedPolicyId === policy.id

                return (
                  <tr
                    key={policy.id}
                    onClick={() =>
                      setSelectedPolicyId(isSelected ? null : policy.id)
                    }
                    className={`border-b border-glomalin-border last:border-0 cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-l-2 border-l-glomalin-accent bg-glomalin-surface'
                        : isAlternateRow
                        ? 'bg-glomalin-bg hover:bg-glomalin-surface'
                        : 'bg-glomalin-surface hover:bg-glomalin-bg'
                    }`}
                  >
                    {/* Farm name */}
                    <td className="px-4 py-3">
                      <span className={hasVerifyNote ? 'text-orange-400' : 'text-glomalin-text'}>
                        {policy.farm_name ?? '(no farm)'}
                      </span>
                      {hasVerifyNote && (
                        <span className="ml-2 text-xs text-orange-400 bg-orange-900/30 rounded px-1 py-0.5">
                          VERIFY
                        </span>
                      )}
                    </td>

                    {/* Crop */}
                    <td className="px-4 py-3 text-glomalin-text">
                      {policy.crop ?? <span className="text-glomalin-muted">(none)</span>}
                    </td>

                    {/* Plan Type */}
                    <td className="px-4 py-3">
                      {policy.plan_type ? (
                        <span className="text-glomalin-accent text-xs font-semibold">{policy.plan_type}</span>
                      ) : (
                        <span className="text-glomalin-muted text-xs">—</span>
                      )}
                    </td>

                    {/* Coverage level */}
                    <td className="px-4 py-3 text-right text-glomalin-text">
                      {policy.coverage_level}%
                    </td>

                    {/* Guarantee bu/ac */}
                    <td className="px-4 py-3 text-right text-glomalin-text">
                      {policy.guarantee > 0 ? (
                        policy.guarantee.toFixed(1)
                      ) : (
                        <span className="text-glomalin-muted">—</span>
                      )}
                    </td>

                    {/* Actual bu/ac */}
                    <td className="px-4 py-3 text-right text-glomalin-text">
                      {policy.actual > 0 ? (
                        <span className="inline-flex items-center justify-end gap-1.5">
                          <span>{policy.actual.toFixed(1)}</span>
                          {policy.actual_synced_from_grain && (
                            <span
                              className="relative group"
                            >
                              <span className="inline-block bg-green-800/50 text-green-300 text-xs px-1.5 py-0.5 rounded font-mono cursor-default select-none">
                                GT
                              </span>
                              {/* Tooltip — visible on hover via group-hover */}
                              <span className="absolute right-0 top-full mt-1 z-10 hidden group-hover:block whitespace-nowrap bg-glomalin-surface border border-glomalin-border text-glomalin-muted text-xs rounded px-2 py-1 shadow-lg font-mono pointer-events-none">
                                Synced from grain tickets
                                {policy.yield_synced_at && (
                                  <span className="block text-glomalin-text mt-0.5">
                                    {new Date(policy.yield_synced_at).toLocaleString('en-US', {
                                      month: 'short', day: 'numeric', year: 'numeric',
                                      hour: 'numeric', minute: '2-digit'
                                    })}
                                  </span>
                                )}
                              </span>
                            </span>
                          )}
                        </span>
                      ) : (
                        <span
                          className="text-glomalin-muted"
                          title="No yield data yet"
                        >
                          —
                        </span>
                      )}
                    </td>

                    {/* Claim alert */}
                    <td className="px-4 py-3 text-center">
                      {policy.claim_alert === 'potential' ? (
                        <span className="inline-flex items-center rounded-full bg-yellow-900/40 border border-yellow-700 px-2 py-0.5 text-xs text-yellow-300 font-medium">
                          Potential
                        </span>
                      ) : (
                        <span className="text-glomalin-muted text-xs">—</span>
                      )}
                    </td>

                    {/* Prevented Planting */}
                    <td className="px-4 py-3 text-center">
                      {policy.prevented_planting ? (() => {
                        const { ppIndemnity, ppFactor } = computePpIndemnity(
                          { guarantee: policy.guarantee, prevented_planting_acres: policy.prevented_planting_acres },
                          initialPricing,
                          policy.crop
                        )
                        void ppFactor
                        return (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-amber-300 bg-amber-950/30 border border-amber-700/50 rounded px-1.5 py-0.5 text-xs font-semibold">
                              PP
                            </span>
                            {ppIndemnity > 0 && (
                              <span className="text-xs text-glomalin-text font-mono">
                                ${ppIndemnity.toLocaleString()}
                              </span>
                            )}
                            {(policy.prevented_planting_acres ?? 0) > 0 && (
                              <span className="text-[10px] text-glomalin-muted font-mono">
                                ({policy.prevented_planting_acres} ac)
                              </span>
                            )}
                          </div>
                        )
                      })() : (
                        <span className="text-glomalin-muted text-xs">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td
                      className="px-4 py-3 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditDrawer(policy)}
                          className="text-xs text-glomalin-muted hover:text-glomalin-accent transition-colors font-mono"
                        >
                          Edit
                        </button>
                        <span className="text-glomalin-border">|</span>
                        <button
                          onClick={() => handleSyncYield(policy.id)}
                          disabled={syncingId === policy.id}
                          className="text-xs text-glomalin-muted hover:text-glomalin-green transition-colors font-mono disabled:opacity-50"
                        >
                          {syncingId === policy.id ? 'Syncing...' : 'Sync Yield'}
                        </button>
                        <span className="text-glomalin-border">|</span>
                        <button
                          onClick={() => setFilingPolicy(policy)}
                          className="text-xs text-glomalin-muted hover:text-glomalin-accent transition-colors font-mono"
                        >
                          File Claim
                        </button>
                        <span className="text-glomalin-border">|</span>
                        <button
                          onClick={() => handleDelete(policy.id)}
                          className="text-xs text-glomalin-muted hover:text-red-400 transition-colors font-mono"
                        >
                          Delete
                        </button>
                      </div>
                      {syncFeedback?.id === policy.id && (
                        <p className={`text-[10px] mt-1 ${syncFeedback.type === 'success' ? 'text-glomalin-green' : 'text-red-400'}`}>
                          {syncFeedback.message}
                        </p>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Production vs Guarantee tracker — shown when policies have yield data */}
      <ProductionTracker policies={policies} />

      {/* APH History — shown when a policy is selected */}
      {selectedPolicy && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-mono font-semibold text-glomalin-accent text-base">
              APH History
            </h2>
            <p className="text-xs text-glomalin-muted font-mono">
              {selectedPolicy.farm_name ?? '(no farm)'} — {selectedPolicy.crop ?? 'no crop'}
            </p>
          </div>
          <AphPanel
            policyId={selectedPolicy.id}
            coverageLevel={selectedPolicy.coverage_level}
            onGuaranteeChange={handleGuaranteeChange}
          />
        </div>
      )}

      {/* Coverage matrix — shown when a policy is selected */}
      {selectedPolicy && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-mono font-semibold text-glomalin-accent text-base">
              Coverage Comparison
            </h2>
            <p className="text-xs text-glomalin-muted font-mono">
              {selectedPolicy.farm_name ?? '(no farm)'} — {selectedPolicy.crop ?? 'no crop'}
            </p>
          </div>
          <CoverageMatrix policy={selectedPolicy} pricing={initialPricing} />
        </div>
      )}

      {/* Payout Simulator — shown when a policy is selected */}
      {selectedPolicy && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-mono font-semibold text-glomalin-accent text-base">
              Payout Simulator
            </h2>
            <p className="text-xs text-glomalin-muted font-mono">
              {selectedPolicy.farm_name ?? '(no farm)'} — {selectedPolicy.crop ?? 'no crop'}
            </p>
          </div>
          <PayoutSimulator policy={selectedPolicy} pricing={initialPricing} />
        </div>
      )}

      {/* Notes section for flagged policies */}
      {policies.some((p) => p.notes && p.notes.includes('VERIFY')) && (
        <div className="mt-4 rounded-md border border-orange-800/50 bg-orange-950/30 px-4 py-3 text-sm">
          <p className="text-orange-400 font-semibold mb-1">Data Review Required</p>
          {policies
            .filter((p) => p.notes && p.notes.includes('VERIFY'))
            .map((p) => (
              <p key={p.id} className="text-orange-300 text-xs">
                {p.farm_name ?? '(no farm)'} / {p.crop ?? 'no crop'}: {p.notes}
              </p>
            ))}
        </div>
      )}

      {/* Policy create/edit drawer */}
      <PolicyDrawer
        open={drawerOpen}
        policy={editingPolicy}
        onClose={() => setDrawerOpen(false)}
        onSave={handleDrawerSave}
        pricing={initialPricing}
      />

      {/* File Claim modal */}
      {filingPolicy !== null && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setFilingPolicy(null)}
            aria-hidden="true"
          />
          {/* Modal card */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-glomalin-surface border border-glomalin-border rounded-lg p-6 font-mono">
              <h2 className="text-glomalin-accent font-semibold text-base mb-1">File a Claim</h2>
              <p className="text-glomalin-muted text-xs mb-4">
                {filingPolicy.farm_name ?? '(no farm)'} — {filingPolicy.crop ?? 'no crop'} — {filingPolicy.plan_type ?? '—'}
              </p>

              <div className="mb-3">
                <label className="block text-xs text-glomalin-muted mb-1">
                  Date of Loss <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={claimDate}
                  onChange={(e) => setClaimDate(e.target.value)}
                  className="w-full bg-glomalin-bg border border-glomalin-border text-glomalin-text font-mono text-sm rounded px-2 py-1.5 focus:outline-none focus:border-glomalin-accent"
                />
              </div>

              <div className="mb-5">
                <label className="block text-xs text-glomalin-muted mb-1">
                  Description <span className="text-glomalin-muted font-normal normal-case">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={claimDesc}
                  onChange={(e) => setClaimDesc(e.target.value)}
                  placeholder="Brief description of loss event..."
                  className="w-full bg-glomalin-bg border border-glomalin-border text-glomalin-text font-mono text-sm rounded px-2 py-1.5 focus:outline-none focus:border-glomalin-accent resize-none placeholder:text-glomalin-muted"
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setFilingPolicy(null)}
                  className="text-sm text-glomalin-muted hover:text-glomalin-text transition-colors font-mono px-3 py-1.5"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFileClaim}
                  disabled={!claimDate || claimSubmitting}
                  className="text-sm font-bold bg-glomalin-accent text-glomalin-bg rounded px-4 py-1.5 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed font-mono"
                >
                  {claimSubmitting ? 'Filing...' : 'Submit Claim'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
