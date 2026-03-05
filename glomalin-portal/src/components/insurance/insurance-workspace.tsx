'use client'

import { useState } from 'react'
import type { InsurancePolicy, PricingEntry } from '@/lib/fsa/calc'
import { PolicyDrawer } from './policy-drawer'
import { CoverageMatrix } from './coverage-matrix'
import { PayoutSimulator } from './payout-simulator'

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
}

interface InsuranceWorkspaceProps {
  initialPolicies: InsurancePolicy[]
  initialPricing: PricingEntry[]
}

export function InsuranceWorkspace({ initialPolicies, initialPricing }: InsuranceWorkspaceProps) {
  const [policies, setPolicies] = useState<InsurancePolicy[]>(initialPolicies)
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create')
  const [editingPolicy, setEditingPolicy] = useState<InsurancePolicy | null>(null)

  // Stat card calculations
  const totalPolicies = policies.length
  const cropsInsured = new Set(
    policies.filter((p) => p.crop && p.crop.trim()).map((p) => p.crop!.trim().toLowerCase())
  ).size
  const claimAlerts = policies.filter((p) => p.claim_alert === 'potential').length

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
          <h1 className="text-2xl font-mono font-semibold text-soil-accent">Crop Insurance</h1>
          <p className="text-soil-muted text-sm mt-1">2026 policy year — decision support tool</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Placeholder for PDF button (Plan 30-02 will wire it) */}
          <div id="insurance-pdf-button-slot" />
          <button
            onClick={openCreateDrawer}
            className="font-mono text-sm font-bold bg-soil-accent text-soil-bg rounded px-4 py-2 hover:opacity-90 transition-opacity"
          >
            Add Policy
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-lg border border-soil-border bg-soil-surface px-5 py-4">
          <p className="text-xs text-soil-muted uppercase tracking-wide font-mono mb-1">Policies</p>
          <p className="text-3xl font-mono font-bold text-soil-text">{totalPolicies}</p>
        </div>
        <div className="rounded-lg border border-soil-border bg-soil-surface px-5 py-4">
          <p className="text-xs text-soil-muted uppercase tracking-wide font-mono mb-1">Crops Insured</p>
          <p className="text-3xl font-mono font-bold text-soil-text">{cropsInsured}</p>
        </div>
        <div className="rounded-lg border border-soil-border bg-soil-surface px-5 py-4">
          <p className="text-xs text-soil-muted uppercase tracking-wide font-mono mb-1">Claim Alerts</p>
          <p className={`text-3xl font-mono font-bold ${claimAlerts > 0 ? 'text-yellow-400' : 'text-soil-text'}`}>
            {claimAlerts}
          </p>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-soil-muted mb-6 italic">
        This is a decision-support tool, not an official insurance summary. Verify all figures
        with your insurance agent before making coverage decisions.
      </p>

      {/* Policy table */}
      {policies.length === 0 ? (
        <div className="rounded-lg border border-soil-border bg-soil-surface px-6 py-12 text-center">
          <p className="text-soil-muted text-sm">
            No insurance policies found for 2026. Click{' '}
            <button
              onClick={openCreateDrawer}
              className="text-soil-accent underline underline-offset-2"
            >
              Add Policy
            </button>{' '}
            to create one, or run{' '}
            <code className="text-soil-accent">npx tsx scripts/migrate-fsa.ts</code> to import
            existing data.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-soil-border overflow-hidden mb-8">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="bg-soil-surface border-b border-soil-border">
                <th className="px-4 py-3 text-left text-soil-accent font-semibold">Farm</th>
                <th className="px-4 py-3 text-left text-soil-accent font-semibold">Crop</th>
                <th className="px-4 py-3 text-left text-soil-accent font-semibold">Plan Type</th>
                <th className="px-4 py-3 text-right text-soil-accent font-semibold">Coverage</th>
                <th className="px-4 py-3 text-right text-soil-accent font-semibold">Guarantee (bu/ac)</th>
                <th className="px-4 py-3 text-right text-soil-accent font-semibold">Actual (bu/ac)</th>
                <th className="px-4 py-3 text-center text-soil-accent font-semibold">Alert</th>
                <th className="px-4 py-3 text-center text-soil-accent font-semibold">Actions</th>
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
                    className={`border-b border-soil-border last:border-0 cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-l-2 border-l-soil-accent bg-soil-surface'
                        : isAlternateRow
                        ? 'bg-soil-bg hover:bg-soil-surface'
                        : 'bg-soil-surface hover:bg-soil-bg'
                    }`}
                  >
                    {/* Farm name */}
                    <td className="px-4 py-3">
                      <span className={hasVerifyNote ? 'text-orange-400' : 'text-soil-text'}>
                        {policy.farm_name ?? '(no farm)'}
                      </span>
                      {hasVerifyNote && (
                        <span className="ml-2 text-xs text-orange-400 bg-orange-900/30 rounded px-1 py-0.5">
                          VERIFY
                        </span>
                      )}
                    </td>

                    {/* Crop */}
                    <td className="px-4 py-3 text-soil-text">
                      {policy.crop ?? <span className="text-soil-muted">(none)</span>}
                    </td>

                    {/* Plan Type */}
                    <td className="px-4 py-3">
                      {policy.plan_type ? (
                        <span className="text-soil-accent text-xs font-semibold">{policy.plan_type}</span>
                      ) : (
                        <span className="text-soil-muted text-xs">—</span>
                      )}
                    </td>

                    {/* Coverage level */}
                    <td className="px-4 py-3 text-right text-soil-text">
                      {policy.coverage_level}%
                    </td>

                    {/* Guarantee bu/ac */}
                    <td className="px-4 py-3 text-right text-soil-text">
                      {policy.guarantee > 0 ? (
                        policy.guarantee.toFixed(1)
                      ) : (
                        <span className="text-soil-muted">—</span>
                      )}
                    </td>

                    {/* Actual bu/ac */}
                    <td className="px-4 py-3 text-right text-soil-text">
                      {policy.actual > 0 ? (
                        <span>
                          {policy.actual.toFixed(1)}
                          {policy.actual_synced_from_grain && (
                            <span className="ml-1 text-xs text-soil-muted" title="Synced from grain tickets">
                              (GT)
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-soil-muted">—</span>
                      )}
                    </td>

                    {/* Claim alert */}
                    <td className="px-4 py-3 text-center">
                      {policy.claim_alert === 'potential' ? (
                        <span className="inline-flex items-center rounded-full bg-yellow-900/40 border border-yellow-700 px-2 py-0.5 text-xs text-yellow-300 font-medium">
                          Potential
                        </span>
                      ) : (
                        <span className="text-soil-muted text-xs">—</span>
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
                          className="text-xs text-soil-muted hover:text-soil-accent transition-colors font-mono"
                        >
                          Edit
                        </button>
                        <span className="text-soil-border">|</span>
                        <button
                          onClick={() => handleDelete(policy.id)}
                          className="text-xs text-soil-muted hover:text-red-400 transition-colors font-mono"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Coverage matrix — shown when a policy is selected */}
      {selectedPolicy && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-mono font-semibold text-soil-accent text-base">
              Coverage Comparison
            </h2>
            <p className="text-xs text-soil-muted font-mono">
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
            <h2 className="font-mono font-semibold text-soil-accent text-base">
              Payout Simulator
            </h2>
            <p className="text-xs text-soil-muted font-mono">
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
      />
    </div>
  )
}
