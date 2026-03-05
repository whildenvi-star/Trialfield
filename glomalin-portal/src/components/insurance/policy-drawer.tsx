'use client'

import { useEffect, useState } from 'react'
import type { InsurancePolicy } from '@/lib/fsa/calc'

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

interface PolicyDrawerProps {
  open: boolean
  policy: InsurancePolicy | null
  onClose: () => void
  onSave: (data: PolicyFormData) => void
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
  }
}

export function PolicyDrawer({ open, policy, onClose, onSave }: PolicyDrawerProps) {
  const isEdit = policy !== null
  const [form, setForm] = useState<PolicyFormData>(EMPTY_FORM)

  // Sync form when policy changes or drawer opens
  useEffect(() => {
    if (open) {
      setForm(isEdit ? policyToForm(policy!) : EMPTY_FORM)
    }
  }, [open, policy, isEdit])

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: name === 'coverage_level' ? Number(value) : value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave(form)
  }

  const inputClass =
    'w-full bg-soil-bg border border-soil-border text-soil-text font-mono text-sm rounded px-2 py-1.5 focus:outline-none focus:border-soil-accent placeholder:text-soil-muted'
  const labelClass = 'block text-xs text-soil-muted font-mono mb-1'
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
        className={`fixed inset-y-0 right-0 z-50 w-[480px] bg-soil-surface border-l border-soil-border flex flex-col transition-transform duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-soil-border">
          <h2 className="font-mono font-semibold text-soil-text text-base">
            {isEdit ? 'Edit Policy' : 'New Policy'}
          </h2>
          <button
            onClick={onClose}
            className="text-soil-muted hover:text-soil-text transition-colors font-mono text-xl leading-none"
            aria-label="Close drawer"
          >
            ×
          </button>
        </div>

        {/* Scrollable form body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4">
          {/* Policy Details */}
          <p className="text-xs text-soil-accent font-mono font-semibold uppercase tracking-wide mb-3">
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
              Plan Type <span className="text-soil-muted normal-case font-normal">(RP is most common)</span>
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
          <p className="text-xs text-soil-accent font-mono font-semibold uppercase tracking-wide mb-3 mt-5">
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

          {/* Other */}
          <p className="text-xs text-soil-accent font-mono font-semibold uppercase tracking-wide mb-3 mt-5">
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
              className="w-full bg-soil-accent text-soil-bg font-mono font-bold text-sm rounded px-4 py-2 hover:opacity-90 transition-opacity"
            >
              {isEdit ? 'Save Changes' : 'Create Policy'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
