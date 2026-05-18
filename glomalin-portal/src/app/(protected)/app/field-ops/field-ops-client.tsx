'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import type { RegistryField } from './page'

interface TcRecord {
  id: string
  operationType: string
  operationDate: string
  notes: string | null
  tcByName: string | null
  tcByCertUserId: string | null
}

interface TcListResponse {
  tcs: TcRecord[]
  fieldEnterpriseId: string
  year: number
  noEnterprise?: boolean
}

interface Operator {
  id: string
  fullName: string
  role: string
}

interface CurrentUser {
  id: string
  role: string
  fullName: string
}

interface FieldOpsClientProps {
  fields: RegistryField[]
  initialFieldId: string | null
}

const OP_TYPES = [
  'Tillage',
  'No-Till',
  'Planting',
  'Herbicide',
  'Fertilizer',
  'Scouting',
  'Harvest',
  'Hauling',
  'Other',
]

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function todayISODate(): string {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

function currentYear(): number {
  return new Date().getFullYear()
}

function yearOptions(): number[] {
  const y = currentYear()
  return [y, y - 1, y - 2, y - 3]
}

// Trash icon inline SVG
function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="currentColor"
    >
      <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
      <path
        fillRule="evenodd"
        d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
      />
    </svg>
  )
}

export function FieldOpsClient({ fields, initialFieldId }: FieldOpsClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const selectedFieldId = searchParams.get('field') ?? initialFieldId

  // Current user profile
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)

  // Search
  const [search, setSearch] = useState('')

  // Year
  const [selectedYear, setSelectedYear] = useState<number>(currentYear())

  // TC data
  const [tcs, setTcs] = useState<TcRecord[]>([])
  const [fieldEnterpriseId, setFieldEnterpriseId] = useState<string | null>(null)
  const [noEnterprise, setNoEnterprise] = useState(false)
  const [loadingTcs, setLoadingTcs] = useState(false)
  const [tcsError, setTcsError] = useState<string | null>(null)

  // Add form
  const [addFormOpen, setAddFormOpen] = useState(false)
  const [formOpType, setFormOpType] = useState(OP_TYPES[0])
  const [formDate, setFormDate] = useState(todayISODate())
  const [formNotes, setFormNotes] = useState('')
  const [formSignOffAs, setFormSignOffAs] = useState('self')
  const [operators, setOperators] = useState<Operator[]>([])
  const [loadingOperators, setLoadingOperators] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Delete confirmation: track which row is pending confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Load current user from Supabase
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', user.id)
        .single()
      setCurrentUser({
        id: user.id,
        role: profile?.role ?? 'viewer',
        fullName: profile?.full_name ?? user.email ?? '',
      })
    })
  }, [])

  // Fetch TCs when field or year changes
  const fetchTcs = useCallback(async (fieldId: string, year: number) => {
    setLoadingTcs(true)
    setTcsError(null)
    setNoEnterprise(false)
    setTcs([])
    setFieldEnterpriseId(null)
    try {
      const res = await fetch(`/api/field-ops/tcs?fieldId=${encodeURIComponent(fieldId)}&year=${year}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to load TCs' }))
        setTcsError((err as { error?: string }).error ?? 'Failed to load TCs')
        return
      }
      const data: TcListResponse = await res.json()
      if (data.noEnterprise) {
        setNoEnterprise(true)
      } else {
        setTcs(data.tcs)
        setFieldEnterpriseId(data.fieldEnterpriseId)
      }
    } catch {
      setTcsError('Network error loading TCs')
    } finally {
      setLoadingTcs(false)
    }
  }, [])

  useEffect(() => {
    if (selectedFieldId) {
      fetchTcs(selectedFieldId, selectedYear)
    }
  }, [selectedFieldId, selectedYear, fetchTcs])

  // Fetch operators when add form opens
  useEffect(() => {
    if (!addFormOpen || operators.length > 0) return
    setLoadingOperators(true)
    fetch('/api/field-ops/operators')
      .then((r) => r.json())
      .then((data: { operators?: Operator[] }) => {
        setOperators(data.operators ?? [])
      })
      .catch(() => {})
      .finally(() => setLoadingOperators(false))
  }, [addFormOpen, operators.length])

  const handleSelectField = useCallback(
    (fieldId: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('field', fieldId)
      router.push(`${pathname}?${params.toString()}`)
      setAddFormOpen(false)
      setDeleteConfirmId(null)
    },
    [router, pathname, searchParams]
  )

  const handleOpenAddForm = () => {
    setAddFormOpen(true)
    setFormOpType(OP_TYPES[0])
    setFormDate(todayISODate())
    setFormNotes('')
    setFormSignOffAs('self')
    setFormError(null)
  }

  const handleSaveTc = async () => {
    if (!selectedFieldId) return
    setSaving(true)
    setFormError(null)

    // Build notes — append sign-off if needed
    let notes = formNotes.trim()
    let tcByOverrideCertUserId: string | undefined
    if (formSignOffAs !== 'self') {
      const op = operators.find((o) => o.id === formSignOffAs)
      if (op) {
        notes = notes ? `${notes} [Signed off by: ${op.fullName}]` : `[Signed off by: ${op.fullName}]`
      }
      tcByOverrideCertUserId = formSignOffAs
    }

    try {
      const res = await fetch('/api/field-ops/tcs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldId: selectedFieldId,
          operationType: formOpType,
          operationDate: formDate,
          notes: notes || undefined,
          tcByOverrideCertUserId,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to save TC' }))
        setFormError((err as { error?: string }).error ?? 'Failed to save TC')
        return
      }

      // Refresh TC list from server
      setAddFormOpen(false)
      await fetchTcs(selectedFieldId, selectedYear)
    } catch {
      setFormError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteClick = (tcId: string) => {
    setDeleteConfirmId(tcId)
  }

  const handleDeleteConfirm = async (tc: TcRecord) => {
    if (!fieldEnterpriseId) return
    setDeleting(tc.id)
    setDeleteConfirmId(null)
    try {
      const params = new URLSearchParams({
        fieldEnterpriseId,
        tcByCertUserId: tc.tcByCertUserId ?? '',
      })
      const res = await fetch(`/api/field-ops/tcs/${tc.id}?${params.toString()}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setTcs((prev) => prev.filter((t) => t.id !== tc.id))
      }
    } catch {
      // silently fail for now — the list stays intact if delete fails
    } finally {
      setDeleting(null)
    }
  }

  // Determine if current user can delete a given TC
  const canDelete = (tc: TcRecord): boolean => {
    if (!currentUser) return false
    if (currentUser.role === 'admin') return true
    // Non-admin: check name match heuristic (cert doesn't store supabase ID)
    return Boolean(tc.tcByName && currentUser.fullName && tc.tcByName === currentUser.fullName)
  }

  // Filtered field list
  const filteredFields = fields.filter((f) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    if (f.name.toLowerCase().includes(q)) return true
    return f.aliases.some((a) => a.toLowerCase().includes(q))
  })

  const selectedField = fields.find((f) => f.id === selectedFieldId) ?? null

  return (
    <div className="flex flex-col md:flex-row w-full h-full overflow-hidden">
      {/* Left sidebar — field list */}
      <aside className="w-full md:w-72 flex-shrink-0 border-b md:border-b-0 md:border-r border-glomalin-border bg-glomalin-surface flex flex-col overflow-hidden max-h-48 md:max-h-none">
        <div className="px-4 py-3 border-b border-glomalin-border">
          <h1 className="text-sm font-mono font-semibold text-glomalin-text">Field Ops TC Log</h1>
          <p className="text-xs font-mono text-glomalin-muted mt-0.5">TC Sign-off Log</p>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-glomalin-border">
          <input
            type="text"
            placeholder="Search fields..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-glomalin-bg border border-glomalin-border rounded px-2 py-1 text-xs font-mono text-glomalin-text placeholder:text-glomalin-muted focus:outline-none focus:border-glomalin-accent"
          />
        </div>

        {/* Field list */}
        <div className="flex-1 overflow-y-auto">
          {filteredFields.map((f) => {
            const isSelected = f.id === selectedFieldId
            return (
              <button
                key={f.id}
                onClick={() => handleSelectField(f.id)}
                className={`w-full text-left px-4 py-2.5 border-b border-glomalin-border hover:bg-glomalin-bg transition-colors ${
                  isSelected
                    ? 'border-l-2 border-l-glomalin-accent bg-glomalin-bg'
                    : 'border-l-2 border-l-transparent'
                }`}
              >
                <p className="text-xs font-mono text-glomalin-text truncate">{f.name}</p>
                {f.reportingAcres > 0 && (
                  <p className="text-xs font-mono text-glomalin-muted mt-0.5">
                    {f.reportingAcres.toFixed(1)} ac
                  </p>
                )}
              </button>
            )
          })}
          {filteredFields.length === 0 && (
            <p className="text-xs font-mono text-glomalin-muted px-4 py-4">No fields match.</p>
          )}
        </div>
      </aside>

      {/* Right workspace */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {!selectedField ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-glomalin-muted font-mono text-sm">
              Select a field to view and add TC records
            </p>
          </div>
        ) : (
          <>
            {/* Header bar */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-glomalin-border bg-glomalin-surface flex-shrink-0">
              <div className="flex items-center gap-4">
                <span className="text-sm font-mono font-semibold text-glomalin-text">
                  {selectedField.name}
                </span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-glomalin-bg border border-glomalin-border rounded px-2 py-1 text-xs font-mono text-glomalin-text focus:outline-none focus:border-glomalin-accent"
                >
                  {yearOptions().map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleOpenAddForm}
                disabled={noEnterprise}
                title={noEnterprise ? 'No organic-cert enterprise for this field' : 'Add TC record'}
                className="bg-glomalin-accent text-black px-3 py-1.5 text-xs font-mono rounded hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                + Add TC
              </button>
            </div>

            {/* No-enterprise notice */}
            {noEnterprise && (
              <div className="px-6 py-3 bg-glomalin-surface border-b border-glomalin-border">
                <p className="text-xs font-mono text-glomalin-muted">
                  This field has no organic-cert enterprise — TC records are only for organic enrolled fields.
                </p>
              </div>
            )}

            {/* Add TC inline form */}
            {addFormOpen && (
              <div className="px-6 py-4 bg-glomalin-surface border-b border-glomalin-border flex-shrink-0">
                <p className="text-xs font-mono font-semibold text-glomalin-text mb-3">New TC Record</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  {/* Operation Type */}
                  <div>
                    <label className="block text-xs font-mono text-glomalin-muted mb-1">
                      Operation Type
                    </label>
                    <select
                      value={formOpType}
                      onChange={(e) => setFormOpType(e.target.value)}
                      className="w-full bg-glomalin-bg border border-glomalin-border rounded px-2 py-1.5 text-xs font-mono text-glomalin-text focus:outline-none focus:border-glomalin-accent"
                    >
                      {OP_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-xs font-mono text-glomalin-muted mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full bg-glomalin-bg border border-glomalin-border rounded px-2 py-1.5 text-xs font-mono text-glomalin-text focus:outline-none focus:border-glomalin-accent"
                    />
                  </div>

                  {/* TC'd by (read-only) */}
                  <div>
                    <label className="block text-xs font-mono text-glomalin-muted mb-1">
                      TC&apos;d by
                    </label>
                    <p className="text-xs font-mono text-glomalin-text py-1.5">
                      {currentUser?.fullName ?? 'Loading...'}
                    </p>
                  </div>

                  {/* Sign off as */}
                  <div>
                    <label className="block text-xs font-mono text-glomalin-muted mb-1">
                      Sign off as
                    </label>
                    <select
                      value={formSignOffAs}
                      onChange={(e) => setFormSignOffAs(e.target.value)}
                      disabled={loadingOperators}
                      className="w-full bg-glomalin-bg border border-glomalin-border rounded px-2 py-1.5 text-xs font-mono text-glomalin-text focus:outline-none focus:border-glomalin-accent disabled:opacity-60"
                    >
                      <option value="self">Self (default)</option>
                      {operators.map((op) => (
                        <option key={op.id} value={op.id}>
                          {op.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div className="mb-3">
                  <label className="block text-xs font-mono text-glomalin-muted mb-1">
                    Notes (optional)
                  </label>
                  <textarea
                    rows={2}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Additional notes..."
                    className="w-full bg-glomalin-bg border border-glomalin-border rounded px-2 py-1.5 text-xs font-mono text-glomalin-text placeholder:text-glomalin-muted focus:outline-none focus:border-glomalin-accent resize-none"
                  />
                </div>

                {formError && (
                  <p className="text-xs font-mono text-red-400 mb-2">{formError}</p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleSaveTc}
                    disabled={saving}
                    className="bg-glomalin-accent text-black px-3 py-1.5 text-xs font-mono rounded hover:opacity-90 disabled:opacity-60"
                  >
                    {saving ? 'Saving...' : 'Save TC'}
                  </button>
                  <button
                    onClick={() => {
                      setAddFormOpen(false)
                      setFormError(null)
                    }}
                    className="px-3 py-1.5 text-xs font-mono text-glomalin-muted border border-glomalin-border rounded hover:border-glomalin-text transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* TC list */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loadingTcs && (
                <p className="text-xs font-mono text-glomalin-muted">Loading...</p>
              )}
              {tcsError && (
                <p className="text-xs font-mono text-red-400">{tcsError}</p>
              )}
              {!loadingTcs && !tcsError && !noEnterprise && tcs.length === 0 && (
                <p className="text-xs font-mono text-glomalin-muted">
                  No TC records for this field and year.
                </p>
              )}
              {!loadingTcs && !tcsError && tcs.length > 0 && (
                <>
                  {/* Mobile card view */}
                  <div className="md:hidden space-y-2">
                    {tcs.map((tc) => (
                      <div
                        key={tc.id}
                        className="bg-glomalin-surface border border-glomalin-border rounded p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-mono font-semibold text-glomalin-text">{tc.operationType}</p>
                            <p className="text-xs font-mono text-glomalin-muted mt-0.5">{formatDate(tc.operationDate)}</p>
                            {tc.tcByName && (
                              <p className="text-xs font-mono text-glomalin-muted">TC&apos;d by {tc.tcByName}</p>
                            )}
                            {tc.notes && (
                              <p className="text-xs font-mono text-glomalin-muted mt-1 line-clamp-2">{tc.notes}</p>
                            )}
                          </div>
                          {canDelete(tc) && deleteConfirmId !== tc.id && (
                            <button
                              onClick={() => handleDeleteClick(tc.id)}
                              disabled={deleting === tc.id}
                              className="text-glomalin-muted hover:text-red-400 transition-colors disabled:opacity-40 shrink-0 p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
                              title="Delete TC"
                            >
                              <TrashIcon />
                            </button>
                          )}
                          {canDelete(tc) && deleteConfirmId === tc.id && (
                            <span className="flex flex-col items-end gap-1 shrink-0">
                              <span className="text-xs font-mono text-glomalin-muted">Delete?</span>
                              <span className="flex gap-2">
                                <button
                                  onClick={() => handleDeleteConfirm(tc)}
                                  className="text-xs font-mono text-red-400 hover:text-red-300 font-semibold min-h-[44px] px-2"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="text-xs font-mono text-glomalin-muted hover:text-glomalin-text min-h-[44px] px-2"
                                >
                                  No
                                </button>
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Desktop table */}
                  <table className="hidden md:table w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-glomalin-border">
                        <th className="text-left py-2 px-3 text-glomalin-muted font-normal">Date</th>
                        <th className="text-left py-2 px-3 text-glomalin-muted font-normal">Operation</th>
                        <th className="text-left py-2 px-3 text-glomalin-muted font-normal">TC&apos;d By</th>
                        <th className="text-left py-2 px-3 text-glomalin-muted font-normal">Notes</th>
                        <th className="py-2 px-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {tcs.map((tc) => (
                        <tr
                          key={tc.id}
                          className="border-b border-glomalin-border hover:bg-glomalin-surface transition-colors"
                        >
                          <td className="py-2 px-3 text-glomalin-text whitespace-nowrap">
                            {formatDate(tc.operationDate)}
                          </td>
                          <td className="py-2 px-3 text-glomalin-text">{tc.operationType}</td>
                          <td className="py-2 px-3 text-glomalin-text">
                            {tc.tcByName ?? 'Unknown'}
                          </td>
                          <td className="py-2 px-3 text-glomalin-muted max-w-xs truncate">
                            {tc.notes ?? ''}
                          </td>
                          <td className="py-2 px-3 text-right whitespace-nowrap">
                            {canDelete(tc) && deleteConfirmId !== tc.id && (
                              <button
                                onClick={() => handleDeleteClick(tc.id)}
                                disabled={deleting === tc.id}
                                className="text-glomalin-muted hover:text-red-400 transition-colors disabled:opacity-40"
                                title="Delete TC"
                              >
                                <TrashIcon />
                              </button>
                            )}
                            {canDelete(tc) && deleteConfirmId === tc.id && (
                              <span className="flex items-center gap-2 justify-end">
                                <span className="text-glomalin-muted">Delete this TC?</span>
                                <button
                                  onClick={() => handleDeleteConfirm(tc)}
                                  className="text-red-400 hover:text-red-300 font-semibold"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="text-glomalin-muted hover:text-glomalin-text"
                                >
                                  Cancel
                                </button>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
