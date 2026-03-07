'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="bg-glomalin-surface border border-glomalin-border rounded-lg p-8 w-full">
      <div className="text-center mb-8">
        <h1 className="text-xl font-bold tracking-wider text-glomalin-accent font-mono">
          Set New Password
        </h1>
        <p className="text-glomalin-muted text-sm mt-1">
          GLOMALIN Farm Operations Portal
        </p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded border border-red-800 bg-red-950/40 text-red-300 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-glomalin-muted text-xs uppercase tracking-wider">
            New Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="new-password"
            className="bg-glomalin-bg border border-glomalin-border text-glomalin-text rounded px-3 py-2 text-sm placeholder:text-glomalin-muted focus:outline-none focus:border-glomalin-accent transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="confirm" className="text-glomalin-muted text-xs uppercase tracking-wider">
            Confirm Password
          </label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="new-password"
            className="bg-glomalin-bg border border-glomalin-border text-glomalin-text rounded px-3 py-2 text-sm placeholder:text-glomalin-muted focus:outline-none focus:border-glomalin-accent transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-glomalin-accent text-glomalin-bg font-bold w-full py-2 rounded text-sm tracking-wide hover:opacity-90 transition-opacity mt-2 disabled:opacity-50"
        >
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  )
}
