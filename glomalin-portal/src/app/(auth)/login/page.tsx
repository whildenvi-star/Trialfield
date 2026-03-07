'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { login } from '@/app/actions/auth'

function LoginForm() {
  const searchParams = useSearchParams()
  const hasError = searchParams.get('error') === 'invalid'
  const isExpired = searchParams.get('expired') === 'true'

  return (
    <div className="bg-glomalin-surface border border-glomalin-border rounded-lg p-8 w-full">
      {/* Branding */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold tracking-widest text-glomalin-accent font-mono">
          GLOMALIN
        </h1>
        <p className="text-glomalin-muted text-sm mt-1">
          Farm Operations Portal
        </p>
      </div>

      {/* Error banner */}
      {hasError && (
        <div className="mb-4 px-4 py-3 rounded border border-red-800 bg-red-950/40 text-red-300 text-sm">
          Invalid email or password. Please try again.
        </div>
      )}

      {/* Expired session banner */}
      {isExpired && (
        <div className="mb-4 px-4 py-3 rounded border border-glomalin-border bg-glomalin-surface text-glomalin-muted text-sm">
          Your session has expired. Please log in again.
        </div>
      )}

      {/* Login form */}
      <form action={login} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-glomalin-muted text-xs uppercase tracking-wider">
            Email
          </label>
          <input
            id="email"
            type="email"
            name="email"
            placeholder="you@example.com"
            required
            autoComplete="email"
            className="bg-glomalin-bg border border-glomalin-border text-glomalin-text rounded px-3 py-2 text-sm placeholder:text-glomalin-muted focus:outline-none focus:border-glomalin-accent transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-glomalin-muted text-xs uppercase tracking-wider">
            Password
          </label>
          <input
            id="password"
            type="password"
            name="password"
            placeholder="••••••••"
            required
            autoComplete="current-password"
            className="bg-glomalin-bg border border-glomalin-border text-glomalin-text rounded px-3 py-2 text-sm placeholder:text-glomalin-muted focus:outline-none focus:border-glomalin-accent transition-colors"
          />
        </div>

        <button
          type="submit"
          className="bg-glomalin-accent text-glomalin-bg font-bold w-full py-2 rounded text-sm tracking-wide hover:opacity-90 transition-opacity mt-2"
        >
          Sign In
        </button>
      </form>

      {/* Forgot password link */}
      <div className="text-center mt-4">
        <Link
          href="/forgot-password"
          className="text-glomalin-muted text-sm hover:text-glomalin-accent transition-colors"
        >
          Forgot your password?
        </Link>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="bg-glomalin-surface border border-glomalin-border rounded-lg p-8 w-full">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-widest text-glomalin-accent font-mono">
            GLOMALIN
          </h1>
          <p className="text-glomalin-muted text-sm mt-1">Farm Operations Portal</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
