'use client'

import { useEffect, useState } from 'react'

// Customer type from schema / organic-cert API response
type Customer = {
  id: string
  farmId?: string
  name: string
  type: string
  shortCode?: string | null
  contactName?: string | null
  phone?: string | null
  email?: string | null
  organicCertNum?: string | null
  notes?: string | null
}

interface CustomerFormState {
  name: string
  type: string
  shortCode: string
  contactName: string
  phone: string
  email: string
  organicCertNum: string
  notes: string
}

const EMPTY_FORM: CustomerFormState = {
  name: '',
  type: '',
  shortCode: '',
  contactName: '',
  phone: '',
  email: '',
  organicCertNum: '',
  notes: '',
}

function customerToForm(customer: Customer): CustomerFormState {
  return {
    name: customer.name ?? '',
    type: customer.type ?? '',
    shortCode: customer.shortCode ?? '',
    contactName: customer.contactName ?? '',
    phone: customer.phone ?? '',
    email: customer.email ?? '',
    organicCertNum: customer.organicCertNum ?? '',
    notes: customer.notes ?? '',
  }
}

interface CustomerFormProps {
  customer: Customer | null
  onSuccess: () => void
  open?: boolean
  onClose?: () => void
}

const inputClass =
  'w-full bg-glomalin-bg border border-glomalin-border text-glomalin-text font-mono text-sm rounded px-2 py-1.5 focus:outline-none focus:border-glomalin-accent placeholder:text-glomalin-muted'
const labelClass = 'block text-xs text-glomalin-muted font-mono mb-1 uppercase tracking-wide'
const fieldClass = 'mb-3'

export function CustomerForm({ customer, onSuccess, open, onClose }: CustomerFormProps) {
  const isEdit = customer !== null
  const [form, setForm] = useState<CustomerFormState>(
    customer ? customerToForm(customer) : EMPTY_FORM
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open === undefined || open) {
      setForm(customer ? customerToForm(customer) : EMPTY_FORM)
      setError(null)
    }
  }, [open, customer])

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.name.trim() && !form.type) {
      setError('Name and type are required.')
      return
    } else if (!form.name.trim()) {
      setError('Name is required.')
      return
    } else if (!form.type) {
      setError('Customer type is required.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const url = isEdit
        ? `/api/cert-proxy/marketing/customers/${customer!.id}`
        : '/api/cert-proxy/marketing/customers'
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const json = await res.json()
        const msg: string = json?.error ?? 'Save failed'
        setError(
          msg.includes('Duplicate')
            ? 'A customer with this name already exists.'
            : msg
        )
      } else {
        onSuccess()
      }
    } catch {
      setError('Save failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

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

        {/* Customer Details */}
        <p className="text-xs text-glomalin-accent font-mono font-semibold uppercase tracking-wide mb-3">
          Customer Details
        </p>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="cf-name">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            id="cf-name"
            name="name"
            type="text"
            aria-label="Name"
            value={form.name}
            onChange={handleChange}
            className={inputClass}
            placeholder="e.g. Heartland Elevator"
          />
        </div>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="cf-type">
            Type <span className="text-red-400">*</span>
          </label>
          <select
            id="cf-type"
            name="type"
            value={form.type}
            onChange={handleChange}
            className={inputClass}
          >
            <option value="">— select —</option>
            <option value="ELEVATOR">Elevator</option>
            <option value="CO_OP">Co-op</option>
            <option value="SPECIALTY">Specialty</option>
            <option value="END_USER">End User</option>
            <option value="MALTSTER">Maltster</option>
          </select>
        </div>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="cf-shortCode">
            Short Code
          </label>
          <input
            id="cf-shortCode"
            name="shortCode"
            type="text"
            value={form.shortCode}
            onChange={handleChange}
            className={inputClass}
            placeholder="e.g. ADM, MRM"
          />
        </div>

        {/* Contact */}
        <p className="text-xs text-glomalin-accent font-mono font-semibold uppercase tracking-wide mb-3 mt-5">
          Contact
        </p>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="cf-contactName">Contact Person</label>
          <input
            id="cf-contactName"
            name="contactName"
            type="text"
            value={form.contactName}
            onChange={handleChange}
            className={inputClass}
            placeholder="e.g. Jane Smith"
          />
        </div>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="cf-phone">Phone</label>
          <input
            id="cf-phone"
            name="phone"
            type="tel"
            value={form.phone}
            onChange={handleChange}
            className={inputClass}
            placeholder="e.g. 555-123-4567"
          />
        </div>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="cf-email">Email</label>
          <input
            id="cf-email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            className={inputClass}
            placeholder="e.g. contact@elevator.com"
          />
        </div>

        {/* Other */}
        <p className="text-xs text-glomalin-accent font-mono font-semibold uppercase tracking-wide mb-3 mt-5">
          Other
        </p>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="cf-organicCertNum">Organic Cert #</label>
          <input
            id="cf-organicCertNum"
            name="organicCertNum"
            type="text"
            value={form.organicCertNum}
            onChange={handleChange}
            className={inputClass}
            placeholder="e.g. OC-12345"
          />
        </div>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="cf-notes">Notes</label>
          <textarea
            id="cf-notes"
            name="notes"
            value={form.notes}
            onChange={handleChange}
            className={`${inputClass} resize-none`}
            rows={3}
            placeholder="Any notes about this customer..."
          />
        </div>

        {/* Submit */}
        <div className="pt-2 pb-4">
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-glomalin-accent text-glomalin-bg font-mono font-semibold text-sm rounded px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Customer'}
          </button>
        </div>
      </form>
    </div>
  )
}
