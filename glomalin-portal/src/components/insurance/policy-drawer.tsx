'use client'

import { useEffect, useState } from 'react'
import type { InsurancePolicy, PricingEntry } from '@/lib/fsa/calc'
import { computePpIndemnity, PP_COVERAGE_FACTOR } from '@/lib/insurance/calc'

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

interface PolicyDrawerProps {
  open: boolean
  policy: InsurancePolicy | null
  onClose: () => void
  onSave: (data: PolicyFormData) => void
  pricing: PricingEntry[]
}

const EMPTY_FORM: PolicyFormData = {
  farm_name: '',
  farm_number: '',
  crop: '',
  plan_type: '',
  coverage_level: 75,
  unit_type: '',
  planted_acres: '',
  guarantee: '',
  actual: '',
  premium_per_acre: '',
  agent_name: '',
  notes: '',
  prevented_planting: false,
  prevented_planting_acres: '',
}

function policyToForm(policy: InsurancePolicy): PolicyFormData {
  return {
    farm_name: policy.farm_name ?? '',
    farm_number: policy.farm_number ?? '',
    crop: policy.crop ?? '',
    plan_type: policy.plan_type ?? '',
    coverage_level: policy.coverage_level ?? 75,
    unit_type: policy.unit_type ?? '',
    planted_acres: policy.planted_acres > 0 ? String(policy.planted_acres) : '',
    guarantee: policy.guarantee > 0 ? String(policy.guarantee) : '',
    actual: policy.actual > 0 ? String(policy.actual) : '',
    premium_per_acre: policy.premium_per_acre != null ? String(policy.premium_per_acre) : '',
    agent_name: policy.agent_name ?? '',
    notes: policy.notes ?? '',
    prevented_planting: policy.prevented_planting ?? false,
    prevented_planting_acres: policy.prevented_planting_acres != null ? String(policy.prevented_planting_acres) : '',
  }
}

export function PolicyDrawer({ open, policy, onClose, onSave, pricing }: PolicyDrawerProps) {
  const isEdit = policy !== null
  const [form, setForm] = useState<PolicyFormData>(EMPTY_FORM)
  const [aphData, setAphData] = useState<{ avgAph: number; count: number; totalRecords: number } | null>(null)
  const [aphLoading, setAphLoading] = useState(false)

  // Sync form when policy changes or drawer opens
  useEffect(() => {
    if (open) {
      setForm(isEdit ? policyToForm(policy!) : EMPTY_FORM)
    }
  }, [open, policy, isEdit])

  // APH auto-fetch from CLU records when drawer opens in edit mode
  useEffect(() => {
    if (!open || !policy?.crop) {
      setAphData(null)
      return
    }
    setAphLoading(true)
    const params = new URLSearchParams({ crop: policy.crop })
    if (policy.farm_name) params.set('farmName', policy.farm_name)
    fetch('/api/insurance/aph-lookup?' + params)
      .then((r) => r.json())
      .then((data) => setAphData(data))
      .catch(() => setAphData(null))
      .finally(() => setAphLoading(false))
  }, [open, policy?.crop, policy?.farm_name])

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    if (name === 'coverage_level') {
      setForm((prev) => ({ ...prev, [name]: Number(value) }))
    } else if (name === 'prevented_planting' && e.target instanceof HTMLInputElement) {
      setForm((prev) => ({ ...prev, prevented_planting: e.target instanceof HTMLInputElement ? e.target.checked : prev.prevented_planting }))
    } else {
      setForm((prev) => ({ ...prev, [name]: value }))
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave(form)
  }

  const inputClass =
    'w-full bg-glomalin-bg border border-glomalin-border text-glomalin-text font-mono text-sm rounded px-2 py-1.5 focus:outline-none focus:border-glomalin-accent placeholder:text-glomalin-muted'
  const labelClass = 'block text-xs text-glomalin-muted font-mono mb-1'
  const fieldClass = 'mb-3'

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Slide-out panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-[480px] bg-glomalin-surface border-l border-glomalin-border flex flex-col transition-transform duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-glomalin-border">
          <h2 className="font-mono font-semibold text-glomalin-text text-base">
            {isEdit ? 'Edit Policy' : 'New Policy'}
          </h2>
          <button
            onClick={onClose}
            className="text-glomalin-muted hover:text-glomalin-text transition-colors font-mono text-xl leading-none"
            aria-label="Close drawer"
          >
            ×
          </button>
        </div>

        {/* Scrollable form body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4">
          {/* Policy Details */}
          <p className="text-xs text-glomalin-accent font-mono font-semibold uppercase tracking-wide mb-3">
            Policy Details
          </p>

          <div className={fieldClass}>
            <label className={labelClass} htmlFor="farm_name">Farm Name</label>
            <input
              id="farm_name"
              name="farm_name"
              type="text"
              value={form.farm_name}
              onChange={handleChange}
              className={inputClass}
              placeholder="e.g. Hughes Farm"
            />
          </div>

          <div className={fieldClass}>
            <label className={labelClass} htmlFor="farm_number">Farm Number</label>
            <input
              id="farm_number"
              name="farm_number"
              type="text"
              value={form.farm_number}
              onChange={handleChange}
              className={inputClass}
              placeholder="e.g. 1234"
            />
          </div>

          <div className={fieldClass}>
            <label className={labelClass} htmlFor="crop">Crop</label>
            <input
              id="crop"
              name="crop"
              type="text"
              value={form.crop}
              onChange={handleChange}
              className={inputClass}
              placeholder="e.g. Corn, Soybeans"
            />
          </div>

          <div className={fieldClass}>
            <label className={labelClass} htmlFor="plan_type">
              Plan Type <span className="text-glomalin-muted normal-case font-normal">(RP is most common)</span>
            </label>
            <select
              id="plan_type"
              name="plan_type"
              value={form.plan_type}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="">— select —</option>
              <option value="RP">RP (Revenue Protection)</option>
              <option value="RP-HPE">RP-HPE (Harvest Price Exclusion)</option>
              <option value="YP">YP (Yield Protection)</option>
            </select>
          </div>

          <div className={fieldClass}>
            <label className={labelClass} htmlFor="coverage_level">Coverage Level</label>
            <select
              id="coverage_level"
              name="coverage_level"
              value={form.coverage_level}
              onChange={handleChange}
              className={inputClass}
            >
              {[50, 55, 60, 65, 70, 75, 80, 85].map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}%
                </option>
              ))}
            </select>
          </div>

          <div className={fieldClass}>
            <label className={labelClass} htmlFor="unit_type">Unit Type</label>
            <input
              id="unit_type"
              name="unit_type"
              type="text"
              value={form.unit_type}
              onChange={handleChange}
              className={inputClass}
              placeholder="e.g. Basic, Optional, Enterprise"
            />
          </div>

          {/* Acres & Yields */}
          <p className="text-xs text-glomalin-accent font-mono font-semibold uppercase tracking-wide mb-3 mt-5">
            Acres &amp; Yields
          </p>

          <div className={fieldClass}>
            <label className={labelClass} htmlFor="planted_acres">
              Planted Acres <span className="text-red-400">*</span>
            </label>
            <input
              id="planted_acres"
              name="planted_acres"
              type="number"
              step="0.01"
              min="0"
              required
              value={form.planted_acres}
              onChange={handleChange}
              className={inputClass}
              placeholder="e.g. 450"
            />
          </div>

          <div className={fieldClass}>
            <label className={labelClass} htmlFor="guarantee">Guarantee (bu/ac)</label>
            <input
              id="guarantee"
              name="guarantee"
              type="number"
              step="0.1"
              min="0"
              value={form.guarantee}
              onChange={handleChange}
              className={inputClass}
              placeholder="e.g. 185"
            />
          </div>

          <div className={fieldClass}>
            <label className={labelClass} htmlFor="actual">Actual (bu/ac)</label>
            <input
              id="actual"
              name="actual"
              type="number"
              step="0.1"
              min="0"
              value={form.actual}
              onChange={handleChange}
              className={inputClass}
              placeholder="e.g. 162"
            />
          </div>

          <div className={fieldClass}>
            <label className={labelClass} htmlFor="premium_per_acre">Premium per Acre ($)</label>
            <input
              id="premium_per_acre"
              name="premium_per_acre"
              type="number"
              step="0.01"
              min="0"
              value={form.premium_per_acre}
              onChange={handleChange}
              className={inputClass}
              placeholder="e.g. 18.50"
            />
          </div>

          {/* APH from CLU Records — informational display only, not a form field */}
          {open && policy && (
            <div className="mb-3 rounded border border-glomalin-border bg-glomalin-bg px-3 py-2 text-xs font-mono">
              <p className="text-glomalin-accent font-semibold mb-1">APH from CLU Records</p>
              {aphLoading ? (
                <p className="text-glomalin-muted">Loading...</p>
              ) : aphData && aphData.count > 0 ? (
                <p className="text-glomalin-text">
                  {aphData.avgAph} bu/ac{' '}
                  <span className="text-glomalin-muted">(avg of {aphData.count} records)</span>
                </p>
              ) : aphData && aphData.totalRecords > 0 && aphData.count === 0 ? (
                <p className="text-glomalin-muted">CLU records found — no APH values entered yet</p>
              ) : (
                <p className="text-glomalin-muted">No matching CLU records found</p>
              )}
            </div>
          )}

          {/* Prevented Planting */}
          <p className="text-xs text-glomalin-accent font-mono font-semibold uppercase tracking-wide mb-3 mt-5">
            Prevented Planting
          </p>

          <div className="mb-3 flex items-center gap-2">
            <input
              id="prevented_planting"
              name="prevented_planting"
              type="checkbox"
              checked={form.prevented_planting}
              onChange={handleChange}
              className="w-4 h-4 rounded border border-glomalin-border bg-glomalin-bg accent-glomalin-accent cursor-pointer"
            />
            <label htmlFor="prevented_planting" className="text-sm text-glomalin-text font-mono cursor-pointer">
              Prevented Planting
            </label>
          </div>

          {form.prevented_planting && (
            <div className="mb-3">
              <label className={labelClass} htmlFor="prevented_planting_acres">PP Acres</label>
              <input
                id="prevented_planting_acres"
                name="prevented_planting_acres"
                type="number"
                step="0.01"
                min="0"
                value={form.prevented_planting_acres}
                onChange={handleChange}
                className={inputClass}
                placeholder="e.g. 450"
              />

              {/* PP indemnity estimate — shown when pp acres entered and pricing available */}
              {(() => {
                const ppAcres = parseFloat(form.prevented_planting_acres)
                const guarantee = parseFloat(form.guarantee)
                if (!isNaN(ppAcres) && ppAcres > 0 && !isNaN(guarantee) && guarantee > 0) {
                  const result = computePpIndemnity(
                    { guarantee, prevented_planting_acres: ppAcres },
                    pricing,
                    form.crop || null
                  )
                  if (result.ppIndemnity > 0) {
                    return (
                      <div className="mt-2 rounded border border-glomalin-border bg-glomalin-bg px-3 py-2 text-xs font-mono">
                        <p className="text-glomalin-accent font-semibold mb-0.5">PP Indemnity Estimate</p>
                        <p className="text-glomalin-text">
                          ${result.ppIndemnity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-glomalin-muted mt-0.5">
                          {guarantee} bu/ac guarantee × {(PP_COVERAGE_FACTOR * 100).toFixed(0)}% × ${result.springPrice.toFixed(2)} spring price × {ppAcres} ac
                        </p>
                      </div>
                    )
                  }
                  return (
                    <p className="mt-1 text-xs text-glomalin-muted font-mono">
                      No pricing data available for {form.crop || 'this crop'}
                    </p>
                  )
                }
                return null
              })()}
            </div>
          )}

          {/* Other */}
          <p className="text-xs text-glomalin-accent font-mono font-semibold uppercase tracking-wide mb-3 mt-5">
            Other
          </p>

          <div className={fieldClass}>
            <label className={labelClass} htmlFor="agent_name">Agent Name</label>
            <input
              id="agent_name"
              name="agent_name"
              type="text"
              value={form.agent_name}
              onChange={handleChange}
              className={inputClass}
              placeholder="e.g. John Smith"
            />
          </div>

          <div className={fieldClass}>
            <label className={labelClass} htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              name="notes"
              value={form.notes}
              onChange={handleChange}
              className={`${inputClass} resize-none`}
              rows={3}
              placeholder="Any notes about this policy..."
            />
          </div>

          {/* Submit */}
          <div className="pt-2 pb-4">
            <button
              type="submit"
              className="w-full bg-glomalin-accent text-glomalin-bg font-mono font-bold text-sm rounded px-4 py-2 hover:opacity-90 transition-opacity"
            >
              {isEdit ? 'Save Changes' : 'Create Policy'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
