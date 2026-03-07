'use client'

import { useEffect, useState } from 'react'
import { MODULES } from '@/lib/modules'

interface UserRow {
  id: string
  email: string
  fullName: string
  role: 'admin' | 'agronomist' | 'operator' | 'viewer'
  lastSignIn: string | null
  modules: Record<string, boolean>
}

interface SavingCell {
  userId: string
  field: string
}

const ROLES = ['admin', 'agronomist', 'operator', 'viewer'] as const

function formatLastSignIn(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return date.toLocaleDateString()
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingCell, setSavingCell] = useState<SavingCell | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<string>('viewer')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)

  async function loadUsers() {
    try {
      const res = await fetch('/api/admin/users')
      if (!res.ok) throw new Error('Failed to load users')
      const data = await res.json()
      setUsers(data.users)
      setCurrentUserId(data.currentUserId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  async function handleRoleChange(userId: string, newRole: string) {
    setSavingCell({ userId, field: 'role' })
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to update role')
      }
      // Update local state after success
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, role: newRole as UserRow['role'] }
            : u
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role')
    } finally {
      setSavingCell(null)
    }
  }

  async function handleModuleToggle(userId: string, moduleId: string, currentGranted: boolean) {
    const newGranted = !currentGranted
    setSavingCell({ userId, field: moduleId })
    try {
      const res = await fetch(`/api/admin/users/${userId}/access`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: moduleId, granted: newGranted }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to update module access')
      }
      // Update local state after success
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, modules: { ...u.modules, [moduleId]: newGranted } }
            : u
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update module access')
    } finally {
      setSavingCell(null)
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError(null)
    setInviteSuccess(null)
    if (!inviteEmail.trim()) {
      setInviteError('Email is required')
      return
    }
    setInviting(true)
    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to invite user')
      setInviteSuccess(`Invite sent to ${inviteEmail.trim()}`)
      setInviteEmail('')
      setInviteRole('viewer')
      // Refresh user list to include newly invited user
      await loadUsers()
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to invite user')
    } finally {
      setInviting(false)
    }
  }

  const isSaving = (userId: string, field: string) =>
    savingCell?.userId === userId && savingCell?.field === field

  return (
    <div>
      <h1 className="text-2xl font-bold font-mono text-glomalin-text tracking-wide mb-8">
        User Management
      </h1>

      {/* Invite form */}
      <div className="mb-8 p-4 border border-glomalin-border rounded bg-glomalin-surface">
        <h2 className="text-sm font-mono font-semibold text-glomalin-muted uppercase tracking-widest mb-3">
          Create New User
        </h2>
        <form onSubmit={handleInvite} className="flex flex-wrap gap-3 items-start">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="user@example.com"
            className="bg-glomalin-bg border border-glomalin-border text-glomalin-text rounded px-3 py-2 font-mono text-sm focus:outline-none focus:border-glomalin-accent w-64"
            disabled={inviting}
            required
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="bg-glomalin-bg border border-glomalin-border text-glomalin-text rounded px-3 py-2 font-mono text-sm focus:outline-none focus:border-glomalin-accent"
            disabled={inviting}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={inviting}
            className="bg-glomalin-accent text-glomalin-bg px-4 py-2 rounded font-bold font-mono text-sm disabled:opacity-50"
          >
            {inviting ? 'Sending...' : 'Invite User'}
          </button>
          {inviteError && (
            <span className="text-red-400 font-mono text-sm self-center">
              {inviteError}
            </span>
          )}
          {inviteSuccess && (
            <span className="text-glomalin-green font-mono text-sm self-center">
              {inviteSuccess}
            </span>
          )}
        </form>
      </div>

      {/* Global error */}
      {error && (
        <div className="mb-4 p-3 border border-red-800 rounded bg-red-900/20 text-red-400 font-mono text-sm">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-4 text-red-300 underline text-xs"
          >
            dismiss
          </button>
        </div>
      )}

      {/* User table */}
      {loading ? (
        <div className="text-glomalin-muted font-mono text-sm">Loading users...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border border-glomalin-border font-mono text-sm">
            <thead>
              <tr className="bg-glomalin-surface">
                <th className="text-left px-4 py-3 text-glomalin-muted font-semibold border-b border-glomalin-border">
                  Name
                </th>
                <th className="text-left px-4 py-3 text-glomalin-muted font-semibold border-b border-glomalin-border">
                  Email
                </th>
                <th className="text-left px-4 py-3 text-glomalin-muted font-semibold border-b border-glomalin-border">
                  Role
                </th>
                {MODULES.map((mod) => (
                  <th
                    key={mod.id}
                    className="text-center px-3 py-3 text-glomalin-muted font-semibold border-b border-glomalin-border whitespace-nowrap"
                    title={mod.label}
                  >
                    {mod.label}
                  </th>
                ))}
                <th className="text-left px-4 py-3 text-glomalin-muted font-semibold border-b border-glomalin-border">
                  Last Login
                </th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td
                    colSpan={3 + MODULES.length + 1}
                    className="text-center px-4 py-6 text-glomalin-muted"
                  >
                    No users found
                  </td>
                </tr>
              )}
              {users.map((user) => {
                const isCurrentUser = user.id === currentUserId
                return (
                  <tr
                    key={user.id}
                    className="border-b border-glomalin-border hover:bg-glomalin-surface/50 transition-colors"
                  >
                    {/* Name */}
                    <td className="px-4 py-3 text-glomalin-text">
                      {user.fullName || (
                        <span className="text-glomalin-muted">—</span>
                      )}
                      {isCurrentUser && (
                        <span className="ml-2 text-xs text-glomalin-accent">(you)</span>
                      )}
                    </td>

                    {/* Email */}
                    <td className="px-4 py-3 text-glomalin-text">{user.email}</td>

                    {/* Role dropdown */}
                    <td className="px-4 py-3">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        disabled={isCurrentUser || isSaving(user.id, 'role')}
                        className={`bg-glomalin-bg border border-glomalin-border text-glomalin-text rounded px-2 py-1 text-xs focus:outline-none focus:border-glomalin-accent transition-opacity ${
                          isCurrentUser
                            ? 'opacity-40 cursor-not-allowed'
                            : isSaving(user.id, 'role')
                            ? 'opacity-50'
                            : ''
                        }`}
                        title={
                          isCurrentUser
                            ? 'You cannot change your own role'
                            : undefined
                        }
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Module toggles */}
                    {MODULES.map((mod) => {
                      const granted = user.modules[mod.id] ?? false
                      const saving = isSaving(user.id, mod.id)
                      return (
                        <td key={mod.id} className="px-3 py-3 text-center">
                          <button
                            onClick={() =>
                              handleModuleToggle(user.id, mod.id, granted)
                            }
                            disabled={saving}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                              saving ? 'opacity-50' : ''
                            } ${
                              granted ? 'bg-glomalin-accent' : 'bg-glomalin-border'
                            }`}
                            title={`${granted ? 'Revoke' : 'Grant'} ${mod.label} access`}
                            aria-label={`${granted ? 'Revoke' : 'Grant'} ${mod.label} access for ${user.email}`}
                          >
                            <span
                              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ${
                                granted ? 'translate-x-5' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </td>
                      )
                    })}

                    {/* Last login */}
                    <td className="px-4 py-3">
                      {user.lastSignIn ? (
                        <span className="text-glomalin-muted">
                          {formatLastSignIn(user.lastSignIn)}
                        </span>
                      ) : (
                        <span className="text-glomalin-muted">Never</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
