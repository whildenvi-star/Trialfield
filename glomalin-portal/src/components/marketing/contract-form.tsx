'use client'

import { useEffect, useMemo, useState } from 'react'

// GrainContractRow — extended from contract-table.tsx with specialty detail fields
export interface GrainContractRow {
  id: string
  instrument:
    | 'PRICED'
    | 'SPOT'
    | 'FOB'
    | 'PRICED_LATER'
    | 'BASIS_FIXED'
    | 'FUTURES_FIXED'
    | 'MIN_PRICE'
    | 'ACCUMULATOR'
  contractedBushels: number
  appliedBushels?: number
  futuresPrice?: number | null
  basis?: number | null
  finalCashPrice?: number | null
  cropYear: number
  deliveryStart?: string | null
  deliveryEnd?: string | null
  deliveryStartDate?: string | null
  deliveryEndDate?: string | null
  location?: string | null
  notes?: string | null
  paymentBasis?: string | null
  customer?: { id: string; name: string; shortCode: string } | null
  customerId?: string
  variant?: { id: string; name: string } | null
  variantId?: string
  status?: 'OPEN' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED' | 'EXPIRED'
  // Specialty details
  seedCornDetails?: {
    acresIrrigated?: number | null
    acresDryland?: number | null
    irrigatedRatePerAcre?: number | null
    drylandRatePerAcre?: number | null
    yieldGoalPerAcre?: number | null
    bonusPricePerBuOver?: number | null
  } | null
  seedUnitDetails?: {
    contractedUnits?: number | null
    pricePerUnit?: number | null
    unitDescription?: string | null
  } | null
  canningCropDetails?: {
    baseRatePerTon?: number | null
    tenderometerTarget?: number | null
    tenderometerAdjPerUnit?: number | null
    qualityFactors?: Array<{ label: string; value: number }> | null
  } | null
  contractPremium?: {
    basePremium?: number | null
    varietyPremium?: number | null
    qualityBonuses?: Array<{ label: string; value: number }> | null
    royaltyDeduction?: number | null
    netPremium?: number | null
  } | null
}

// ─── Module-level constants ────────────────────────────────────────────────

export const SHOWS_FUTURES_PRICE = new Set(['PRICED', 'FUTURES_FIXED'])
export const SHOWS_BASIS = new Set(['PRICED', 'BASIS_FIXED', 'FOB'])

export const INSTRUMENT_LABELS: Record<string, string> = {
  PRICED: 'Priced',
  SPOT: 'Spot',
  FOB: 'FOB',
  PRICED_LATER: 'Price To Follow (PTF)',
  BASIS_FIXED: 'Basis Fixed',
  FUTURES_FIXED: 'HTA (Futures Fixed)',
  MIN_PRICE: 'Min Price',
  ACCUMULATOR: 'Accumulator',
}

// ─── Form state ────────────────────────────────────────────────────────────

interface ContractFormState {
  customerId: string
  variantId: string
  instrumentType: string
  cropYear: string
  contractedBushels: string
  futuresPrice: string
  basis: string
  paymentBasis: string
  // Specialty: PER_ACRE
  acresIrrigated: string
  acresDryland: string
  irrigatedRatePerAcre: string
  drylandRatePerAcre: string
  yieldGoalPerAcre: string
  bonusPricePerBuOver: string
  // Specialty: PER_UNIT
  contractedUnits: string
  pricePerUnit: string
  unitDescription: string
  // Specialty: PER_TON
  baseRatePerTon: string
  tenderometerTarget: string
  tenderometerAdjPerUnit: string
  qualityFactors: string
  // Delivery
  deliveryStart: string
  deliveryEnd: string
  location: string
  notes: string
  // Premium
  hasPremium: boolean
  basePremium: string
  varietyPremium: string
  qualityBonuses: string
  royaltyDeduction: string
}

const EMPTY_FORM: ContractFormState = {
  customerId: '',
  variantId: '',
  instrumentType: '',
  cropYear: String(new Date().getFullYear()),
  contractedBushels: '',
  futuresPrice: '',
  basis: '',
  paymentBasis: 'PER_BUSHEL',
  // PER_ACRE
  acresIrrigated: '',
  acresDryland: '',
  irrigatedRatePerAcre: '',
  drylandRatePerAcre: '',
  yieldGoalPerAcre: '',
  bonusPricePerBuOver: '',
  // PER_UNIT
  contractedUnits: '',
  pricePerUnit: '',
  unitDescription: '',
  // PER_TON
  baseRatePerTon: '',
  tenderometerTarget: '',
  tenderometerAdjPerUnit: '',
  qualityFactors: '',
  // Delivery
  deliveryStart: '',
  deliveryEnd: '',
  location: '',
  notes: '',
  // Premium
  hasPremium: false,
  basePremium: '',
  varietyPremium: '',
  qualityBonuses: '',
  royaltyDeduction: '',
}

// ─── contractToForm helper ─────────────────────────────────────────────────

function str(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return ''
  return String(v)
}

function bonusesToText(
  arr: Array<{ label: string; value: number }> | null | undefined
): string {
  if (!arr || arr.length === 0) return ''
  return arr.map((b) => `${b.label}: ${b.value}`).join('\n')
}

export function contractToForm(contract: GrainContractRow): ContractFormState {
  const scd = contract.seedCornDetails
  const sud = contract.seedUnitDetails
  const ccd = contract.canningCropDetails
  const cp = contract.contractPremium

  return {
    customerId: contract.customerId ?? contract.customer?.id ?? '',
    variantId: contract.variantId ?? contract.variant?.id ?? '',
    instrumentType: contract.instrument ?? '',
    cropYear: str(contract.cropYear),
    contractedBushels: str(contract.contractedBushels),
    futuresPrice: str(contract.futuresPrice),
    basis: str(contract.basis),
    paymentBasis: contract.paymentBasis ?? 'PER_BUSHEL',
    // PER_ACRE
    acresIrrigated: str(scd?.acresIrrigated),
    acresDryland: str(scd?.acresDryland),
    irrigatedRatePerAcre: str(scd?.irrigatedRatePerAcre),
    drylandRatePerAcre: str(scd?.drylandRatePerAcre),
    yieldGoalPerAcre: str(scd?.yieldGoalPerAcre),
    bonusPricePerBuOver: str(scd?.bonusPricePerBuOver),
    // PER_UNIT
    contractedUnits: str(sud?.contractedUnits),
    pricePerUnit: str(sud?.pricePerUnit),
    unitDescription: str(sud?.unitDescription),
    // PER_TON
    baseRatePerTon: str(ccd?.baseRatePerTon),
    tenderometerTarget: str(ccd?.tenderometerTarget),
    tenderometerAdjPerUnit: str(ccd?.tenderometerAdjPerUnit),
    qualityFactors: bonusesToText(ccd?.qualityFactors),
    // Delivery
    deliveryStart:
      contract.deliveryStart ??
      (contract.deliveryStartDate
        ? contract.deliveryStartDate.split('T')[0]
        : ''),
    deliveryEnd:
      contract.deliveryEnd ??
      (contract.deliveryEndDate
        ? contract.deliveryEndDate.split('T')[0]
        : ''),
    location: str(contract.location),
    notes: str(contract.notes),
    // Premium
    hasPremium: !!cp,
    basePremium: str(cp?.basePremium),
    varietyPremium: str(cp?.varietyPremium),
    qualityBonuses: bonusesToText(cp?.qualityBonuses),
    royaltyDeduction: str(cp?.royaltyDeduction),
  }
}

// ─── Styling constants ─────────────────────────────────────────────────────

const inputClass =
  'w-full bg-glomalin-bg border border-glomalin-border text-glomalin-text font-mono text-sm rounded px-2 py-1.5 focus:outline-none focus:border-glomalin-accent placeholder:text-glomalin-muted'
const labelClass =
  'block text-xs text-glomalin-muted font-mono mb-1 uppercase tracking-wide'
const fieldClass = 'mb-3'
const filterSelectClass =
  'bg-glomalin-bg border border-glomalin-border text-glomalin-text font-mono text-xs rounded px-2 py-1 focus:outline-none focus:border-glomalin-accent'

// ─── parseBonus helper ─────────────────────────────────────────────────────

function parseQualityBonuses(
  text: string
): Array<{ label: string; value: number }> {
  return text
    .split('\n')
    .map((line) => {
      const colonIdx = line.lastIndexOf(':')
      if (colonIdx === -1) return null
      const label = line.slice(0, colonIdx).trim()
      const value = parseFloat(line.slice(colonIdx + 1).trim())
      if (!label || !isFinite(value)) return null
      return { label, value }
    })
    .filter((x): x is { label: string; value: number } => x !== null)
}

// ─── ContractForm props ────────────────────────────────────────────────────

interface ContractFormProps {
  contract: GrainContractRow | null
  customers: { id: string; name: string; shortCode: string; type: string }[]
  variants: {
    id: string
    name: string
    cropYear: number
    commodity?: { name: string }
  }[]
  onSuccess: () => void
  open: boolean
  role: string
}

// ─── Component ─────────────────────────────────────────────────────────────

export function ContractForm({
  contract,
  customers,
  variants,
  onSuccess,
  open,
  role,
}: ContractFormProps) {
  const isEdit = contract !== null
  const canSeeFinancials = role !== 'OFFICE'

  const [form, setForm] = useState<ContractFormState>(
    contract ? contractToForm(contract) : EMPTY_FORM
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Reset form when drawer opens or contract changes
  useEffect(() => {
    if (open) {
      setForm(contract ? contractToForm(contract) : EMPTY_FORM)
      setError(null)
    }
  }, [open, contract])

  // ── Derived visibility flags ────────────────────────────────────────────

  const showFuturesPrice = SHOWS_FUTURES_PRICE.has(form.instrumentType)
  const showBasis = SHOWS_BASIS.has(form.instrumentType)
  const showSeedCorn = form.paymentBasis === 'PER_ACRE'
  const showSeedUnit = form.paymentBasis === 'PER_UNIT'
  const showCanning = form.paymentBasis === 'PER_TON'

  // ── Computed netPremium ─────────────────────────────────────────────────

  const netPremium = useMemo(() => {
    const base = parseFloat(form.basePremium) || 0
    const variety = parseFloat(form.varietyPremium) || 0
    const royalty = parseFloat(form.royaltyDeduction) || 0
    const bonusSum = form.qualityBonuses
      .split('\n')
      .map((line) => parseFloat(line.split(':')[1]?.trim() ?? '') || 0)
      .reduce((a, b) => a + b, 0)
    return base + variety - royalty + bonusSum
  }, [
    form.basePremium,
    form.varietyPremium,
    form.royaltyDeduction,
    form.qualityBonuses,
  ])

  // ── Handlers ────────────────────────────────────────────────────────────

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function variantLabel(v: {
    id: string
    name: string
    cropYear: number
    commodity?: { name: string }
  }): string {
    if (v.commodity) {
      return `${v.commodity.name} — ${v.name} (${v.cropYear})`
    }
    return `${v.name} (${v.cropYear})`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // ── Validation ────────────────────────────────────────────────────────
    const errors: string[] = []
    if (!form.customerId) errors.push('Customer is required')
    if (!form.variantId) errors.push('Grain variant is required')
    if (!form.instrumentType) errors.push('Instrument type is required')
    const bushelsNum = parseFloat(form.contractedBushels)
    if (!form.contractedBushels || !isFinite(bushelsNum)) {
      errors.push('Contracted bushels must be a valid number')
    }
    const cropYearNum = parseInt(form.cropYear, 10)
    if (!form.cropYear || isNaN(cropYearNum)) {
      errors.push('Crop year is required')
    }

    if (errors.length > 0) {
      setError(errors.join('. '))
      return
    }

    setSaving(true)
    setError(null)

    try {
      // ── Build submit body (Pitfall 1 guard: null out stale price fields) ─
      const body: Record<string, unknown> = {
        customerId: form.customerId,
        variantId: form.variantId,
        instrument: form.instrumentType,
        cropYear: cropYearNum,
        contractedBushels: bushelsNum,
        paymentBasis: form.paymentBasis,
        // Price fields — nulled out when instrument doesn't show them or role is OFFICE
        futuresPrice: (canSeeFinancials && SHOWS_FUTURES_PRICE.has(form.instrumentType))
          ? parseFloat(form.futuresPrice) || null
          : null,
        basis: (canSeeFinancials && SHOWS_BASIS.has(form.instrumentType))
          ? parseFloat(form.basis) || null
          : null,
        // Delivery
        deliveryStart: form.deliveryStart || null,
        deliveryEnd: form.deliveryEnd || null,
        location: form.location || null,
        notes: form.notes || null,
        hasPremium: form.hasPremium,
      }

      // ── Specialty sections ────────────────────────────────────────────
      if (form.paymentBasis === 'PER_ACRE') {
        body.seedCornDetails = {
          acresIrrigated: parseFloat(form.acresIrrigated) || 0,
          acresDryland: parseFloat(form.acresDryland) || 0,
          irrigatedRatePerAcre: parseFloat(form.irrigatedRatePerAcre) || null,
          drylandRatePerAcre: parseFloat(form.drylandRatePerAcre) || null,
          yieldGoalPerAcre: parseFloat(form.yieldGoalPerAcre) || null,
          bonusPricePerBuOver: parseFloat(form.bonusPricePerBuOver) || null,
        }
      }

      if (form.paymentBasis === 'PER_UNIT') {
        body.seedUnitDetails = {
          contractedUnits: parseFloat(form.contractedUnits) || null,
          pricePerUnit: parseFloat(form.pricePerUnit) || null,
          unitDescription: form.unitDescription || null,
        }
      }

      if (form.paymentBasis === 'PER_TON') {
        body.canningCropDetails = {
          baseRatePerTon: parseFloat(form.baseRatePerTon) || null,
          tenderometerTarget: parseFloat(form.tenderometerTarget) || null,
          tenderometerAdjPerUnit:
            parseFloat(form.tenderometerAdjPerUnit) || null,
          qualityFactors: parseQualityBonuses(form.qualityFactors),
        }
      }

      // ── Premium section ──────────────────────────────────────────────
      if (form.hasPremium) {
        body.contractPremium = {
          basePremium: parseFloat(form.basePremium) || 0,
          varietyPremium: parseFloat(form.varietyPremium) || 0,
          royaltyDeduction: parseFloat(form.royaltyDeduction) || 0,
          qualityBonuses: parseQualityBonuses(form.qualityBonuses),
          netPremium,
        }
      }

      const url = isEdit
        ? `/api/cert-proxy/marketing/contracts/${contract!.id}`
        : '/api/cert-proxy/marketing/contracts'

      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const json = await res.json()
        setError(json?.error ?? 'Save failed.')
      } else {
        onSuccess()
      }
    } catch {
      setError('Save failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ── Disabled input styling ──────────────────────────────────────────────

  const lockedInputClass = `${inputClass} opacity-50 cursor-not-allowed`

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit}>
        {/* Error banner */}
        {error && (
          <div
            role="alert"
            className="bg-red-900/20 border border-glomalin-danger text-glomalin-danger text-sm font-mono px-3 py-2 rounded mb-3"
          >
            {error}
          </div>
        )}

        {/* ── Contract Details ──────────────────────────────────────────── */}
        <p className="text-xs text-glomalin-accent font-mono font-semibold uppercase tracking-wide mb-3">
          Contract Details
        </p>

        {/* Customer */}
        <div className={fieldClass}>
          <label className={labelClass} htmlFor="cf-customerId">
            Customer <span className="text-red-400">*</span>
          </label>
          <select
            id="cf-customerId"
            name="customerId"
            value={form.customerId}
            onChange={handleChange}
            className={inputClass}
          >
            <option value="">— select —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Grain Variant */}
        <div className={fieldClass}>
          <label className={labelClass} htmlFor="cf-variantId">
            Grain Variant <span className="text-red-400">*</span>
          </label>
          <select
            id="cf-variantId"
            name="variantId"
            value={form.variantId}
            onChange={handleChange}
            className={inputClass}
          >
            <option value="">— select —</option>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {variantLabel(v)}
              </option>
            ))}
          </select>
        </div>

        {/* Instrument Type */}
        <div className={fieldClass}>
          <label className={labelClass} htmlFor="cf-instrumentType">
            Instrument Type <span className="text-red-400">*</span>
          </label>
          <select
            id="cf-instrumentType"
            name="instrumentType"
            value={form.instrumentType}
            onChange={handleChange}
            className={inputClass}
          >
            <option value="">— select —</option>
            {Object.entries(INSTRUMENT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Crop Year */}
        <div className={fieldClass}>
          <label className={labelClass} htmlFor="cf-cropYear">
            Crop Year <span className="text-red-400">*</span>
          </label>
          <input
            id="cf-cropYear"
            name="cropYear"
            type="number"
            step="1"
            min="2020"
            value={form.cropYear}
            onChange={handleChange}
            className={inputClass}
          />
        </div>

        {/* Contracted Bushels */}
        <div className={fieldClass}>
          <label className={labelClass} htmlFor="cf-contractedBushels">
            Contracted Bushels <span className="text-red-400">*</span>
          </label>
          <input
            id="cf-contractedBushels"
            name="contractedBushels"
            type="number"
            step="1"
            aria-label="Contracted Bushels"
            value={form.contractedBushels}
            onChange={handleChange}
            className={inputClass}
            placeholder="e.g. 5000"
          />
        </div>

        {/* ── Conditional price fields ──────────────────────────────────── */}

        {showFuturesPrice && canSeeFinancials && (
          <div className={fieldClass}>
            <label className={labelClass} htmlFor="cf-futuresPrice">
              Futures Price $/bu{' '}
              {isEdit && (
                <span className="text-glomalin-muted">(locked)</span>
              )}
            </label>
            <input
              id="cf-futuresPrice"
              name="futuresPrice"
              type="number"
              step="0.0001"
              aria-label="Futures Price"
              value={form.futuresPrice}
              onChange={handleChange}
              disabled={isEdit}
              className={isEdit ? lockedInputClass : inputClass}
              placeholder="e.g. 4.85"
            />
          </div>
        )}

        {showBasis && canSeeFinancials && (
          <div className={fieldClass}>
            <label className={labelClass} htmlFor="cf-basis">
              Basis $/bu{' '}
              {isEdit && (
                <span className="text-glomalin-muted">(locked)</span>
              )}
            </label>
            <input
              id="cf-basis"
              name="basis"
              type="number"
              step="0.0001"
              aria-label="Basis"
              value={form.basis}
              onChange={handleChange}
              disabled={isEdit}
              className={isEdit ? lockedInputClass : inputClass}
              placeholder="e.g. -0.35"
            />
          </div>
        )}

        {/* ── Payment Basis ─────────────────────────────────────────────── */}
        <p className="text-xs text-glomalin-accent font-mono font-semibold uppercase tracking-wide mb-3 mt-5">
          Payment Basis
        </p>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="cf-paymentBasis">
            Payment Basis
          </label>
          <select
            id="cf-paymentBasis"
            name="paymentBasis"
            value={form.paymentBasis}
            onChange={handleChange}
            className={inputClass}
          >
            <option value="PER_BUSHEL">Per Bushel</option>
            <option value="PER_ACRE">Per Acre</option>
            <option value="PER_UNIT">Per Unit</option>
            <option value="PER_TON">Per Ton</option>
          </select>
        </div>

        {/* ── Seed Corn Details (PER_ACRE) ──────────────────────────────── */}
        {showSeedCorn && (
          <>
            <p className="text-xs text-glomalin-muted font-mono font-semibold uppercase tracking-wide mb-3 mt-4">
              — Seed Corn Details —
            </p>

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="cf-acresIrrigated">
                Acres Irrigated
              </label>
              <input
                id="cf-acresIrrigated"
                name="acresIrrigated"
                type="number"
                step="1"
                aria-label="Acres Irrigated"
                value={form.acresIrrigated}
                onChange={handleChange}
                className={inputClass}
                placeholder="0"
              />
            </div>

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="cf-acresDryland">
                Acres Dryland
              </label>
              <input
                id="cf-acresDryland"
                name="acresDryland"
                type="number"
                step="1"
                value={form.acresDryland}
                onChange={handleChange}
                className={inputClass}
                placeholder="0"
              />
            </div>

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="cf-irrigatedRatePerAcre">
                Irrigated Rate $/acre
              </label>
              <input
                id="cf-irrigatedRatePerAcre"
                name="irrigatedRatePerAcre"
                type="number"
                step="0.01"
                value={form.irrigatedRatePerAcre}
                onChange={handleChange}
                className={inputClass}
                placeholder="e.g. 850.00"
              />
            </div>

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="cf-drylandRatePerAcre">
                Dryland Rate $/acre
              </label>
              <input
                id="cf-drylandRatePerAcre"
                name="drylandRatePerAcre"
                type="number"
                step="0.01"
                value={form.drylandRatePerAcre}
                onChange={handleChange}
                className={inputClass}
                placeholder="e.g. 700.00"
              />
            </div>

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="cf-yieldGoalPerAcre">
                Yield Goal bu/acre
              </label>
              <input
                id="cf-yieldGoalPerAcre"
                name="yieldGoalPerAcre"
                type="number"
                step="0.1"
                value={form.yieldGoalPerAcre}
                onChange={handleChange}
                className={inputClass}
                placeholder="e.g. 200"
              />
            </div>

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="cf-bonusPricePerBuOver">
                Bonus Price $/bu Over Goal
              </label>
              <input
                id="cf-bonusPricePerBuOver"
                name="bonusPricePerBuOver"
                type="number"
                step="0.0001"
                value={form.bonusPricePerBuOver}
                onChange={handleChange}
                className={inputClass}
                placeholder="e.g. 0.05"
              />
            </div>
          </>
        )}

        {/* ── Seed Unit Details (PER_UNIT) ──────────────────────────────── */}
        {showSeedUnit && (
          <>
            <p className="text-xs text-glomalin-muted font-mono font-semibold uppercase tracking-wide mb-3 mt-4">
              — Seed Unit Details —
            </p>

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="cf-contractedUnits">
                Contracted Units
              </label>
              <input
                id="cf-contractedUnits"
                name="contractedUnits"
                type="number"
                step="1"
                aria-label="Contracted Units"
                value={form.contractedUnits}
                onChange={handleChange}
                className={inputClass}
                placeholder="e.g. 100"
              />
            </div>

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="cf-pricePerUnit">
                Price Per Unit $/unit
              </label>
              <input
                id="cf-pricePerUnit"
                name="pricePerUnit"
                type="number"
                step="0.01"
                value={form.pricePerUnit}
                onChange={handleChange}
                className={inputClass}
                placeholder="e.g. 45.00"
              />
            </div>

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="cf-unitDescription">
                Unit Description
              </label>
              <input
                id="cf-unitDescription"
                name="unitDescription"
                type="text"
                value={form.unitDescription}
                onChange={handleChange}
                className={inputClass}
                placeholder="e.g. 50 lb bag"
              />
            </div>
          </>
        )}

        {/* ── Canning Crop Details (PER_TON) ───────────────────────────── */}
        {showCanning && (
          <>
            <p className="text-xs text-glomalin-muted font-mono font-semibold uppercase tracking-wide mb-3 mt-4">
              — Canning Crop Details —
            </p>

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="cf-baseRatePerTon">
                Base Rate $/ton
              </label>
              <input
                id="cf-baseRatePerTon"
                name="baseRatePerTon"
                type="number"
                step="0.01"
                aria-label="Base Rate Per Ton"
                value={form.baseRatePerTon}
                onChange={handleChange}
                className={inputClass}
                placeholder="e.g. 120.00"
              />
            </div>

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="cf-tenderometerTarget">
                Tenderometer Target
              </label>
              <input
                id="cf-tenderometerTarget"
                name="tenderometerTarget"
                type="number"
                step="0.1"
                value={form.tenderometerTarget}
                onChange={handleChange}
                className={inputClass}
                placeholder="e.g. 110"
              />
            </div>

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="cf-tenderometerAdjPerUnit">
                Tenderometer Adj $/ton/unit
              </label>
              <input
                id="cf-tenderometerAdjPerUnit"
                name="tenderometerAdjPerUnit"
                type="number"
                step="0.0001"
                value={form.tenderometerAdjPerUnit}
                onChange={handleChange}
                className={inputClass}
                placeholder="e.g. 0.50"
              />
            </div>

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="cf-qualityFactors">
                Quality Factors
              </label>
              <textarea
                id="cf-qualityFactors"
                name="qualityFactors"
                value={form.qualityFactors}
                onChange={handleChange}
                className={`${inputClass} resize-none`}
                rows={3}
                placeholder="Purity bonus: 0.10"
              />
            </div>
          </>
        )}

        {/* ── Delivery Window ───────────────────────────────────────────── */}
        <p className="text-xs text-glomalin-accent font-mono font-semibold uppercase tracking-wide mb-3 mt-5">
          Delivery Window
        </p>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="cf-deliveryStart">
            Delivery Start
          </label>
          <input
            id="cf-deliveryStart"
            name="deliveryStart"
            type="date"
            value={form.deliveryStart}
            onChange={handleChange}
            className={inputClass}
          />
        </div>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="cf-deliveryEnd">
            Delivery End
          </label>
          <input
            id="cf-deliveryEnd"
            name="deliveryEnd"
            type="date"
            value={form.deliveryEnd}
            onChange={handleChange}
            className={inputClass}
          />
        </div>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="cf-location">
            Location
          </label>
          <input
            id="cf-location"
            name="location"
            type="text"
            value={form.location}
            onChange={handleChange}
            className={inputClass}
            placeholder="e.g. Heartland Elevator, Pekin"
          />
        </div>

        {/* ── Notes ────────────────────────────────────────────────────── */}
        <p className="text-xs text-glomalin-accent font-mono font-semibold uppercase tracking-wide mb-3 mt-5">
          Notes
        </p>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="cf-notes">
            Notes
          </label>
          <textarea
            id="cf-notes"
            name="notes"
            value={form.notes}
            onChange={handleChange}
            className={`${inputClass} resize-none`}
            rows={3}
          />
        </div>

        {/* ── Premium toggle ────────────────────────────────────────────── */}
        <div className="mb-3 flex items-center gap-2">
          <input
            id="cf-hasPremium"
            name="hasPremium"
            type="checkbox"
            checked={form.hasPremium}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, hasPremium: e.target.checked }))
            }
            className="accent-glomalin-accent"
          />
          <label
            htmlFor="cf-hasPremium"
            className="text-xs text-glomalin-text font-mono uppercase tracking-wide cursor-pointer"
          >
            Add IP / Seed Premium
          </label>
        </div>

        {/* ── Contract Premium section ──────────────────────────────────── */}
        {form.hasPremium && (
          <>
            <p className="text-xs text-glomalin-muted font-mono font-semibold uppercase tracking-wide mb-3 mt-4">
              — Contract Premium —
            </p>

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="cf-basePremium">
                Base Premium $/bu
              </label>
              <input
                id="cf-basePremium"
                name="basePremium"
                type="number"
                step="0.0001"
                aria-label="Base Premium"
                value={form.basePremium}
                onChange={handleChange}
                className={inputClass}
                placeholder="e.g. 0.10"
              />
            </div>

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="cf-varietyPremium">
                Variety Premium $/bu
              </label>
              <input
                id="cf-varietyPremium"
                name="varietyPremium"
                type="number"
                step="0.0001"
                value={form.varietyPremium}
                onChange={handleChange}
                className={inputClass}
                placeholder="e.g. 0.05"
              />
            </div>

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="cf-qualityBonuses">
                Quality Bonuses
              </label>
              <textarea
                id="cf-qualityBonuses"
                name="qualityBonuses"
                value={form.qualityBonuses}
                onChange={handleChange}
                className={`${inputClass} resize-none`}
                rows={3}
                placeholder="Purity bonus: 0.10"
              />
            </div>

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="cf-royaltyDeduction">
                Royalty Deduction $/bu
              </label>
              <input
                id="cf-royaltyDeduction"
                name="royaltyDeduction"
                type="number"
                step="0.0001"
                value={form.royaltyDeduction}
                onChange={handleChange}
                className={inputClass}
                placeholder="e.g. 0.03"
              />
            </div>

            {/* Net premium read-only display */}
            <div className={fieldClass}>
              <p className={labelClass}>Net Premium $/bu</p>
              <p className="font-mono text-sm text-glomalin-accent">
                {netPremium >= 0 ? '+' : ''}
                {netPremium.toFixed(4)}
              </p>
            </div>
          </>
        )}

        {/* ── Submit ───────────────────────────────────────────────────── */}
        <div className="pt-2 pb-4">
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-glomalin-accent text-glomalin-bg font-mono font-semibold text-sm rounded px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Contract'}
          </button>
        </div>
      </form>
    </div>
  )
}
