'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { resetPassword } from '@/app/actions/auth'

function ForgotPasswordForm() {
  const searchParams = useSearchParams()
  const isSent = searchParams.get('sent') === 'true'

  return (
    <div className="bg-soil-surface border border-soil-border rounded-lg p-8 w-full">
      {/* Branding */}
      <div className="text-center mb-8">
        <h1 className="text-xl font-bold tracking-wider text-soil-accent font-mono">
          Reset Password
        </h1>
        <p className="text-soil-muted text-sm mt-1">
          GLOMALIN Farm Operations Portal
        </p>
      </div>

      {/* Sent confirmation */}
      {isSent && (
        <div className="mb-4 px-4 py-3 rounded border border-soil-green bg-soil-green/10 text-soil-green text-sm">
          If an account exists with that email, a password reset link has been sent.
        </div>
      )}

      {/* Reset form */}
      <form action={resetPassword} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-soil-muted text-xs uppercase tracking-wider">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            name="email"
            placeholder="you@example.com"
            required
            autoComplete="email"
            className="bg-soil-bg border border-soil-border text-soil-text rounded px-3 py-2 text-sm placeholder:text-soil-muted focus:outline-none focus:border-soil-accent transition-colors"
          />
        </div>

        <button
          type="submit"
          className="bg-soil-accent text-soil-bg font-bold w-full py-2 rounded text-sm tracking-wide hover:opacity-90 transition-opacity mt-2"
        >
          Send Reset Link
        </button>
      </form>

      {/* Back to login link */}
      <div className="text-center mt-4">
        <Link
          href="/login"
          className="text-soil-muted text-sm hover:text-soil-accent transition-colors"
        >
          Back to login
        </Link>
      </div>
    </div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div className="bg-soil-surface border border-soil-border rounded-lg p-8 w-full">
        <div className="text-center">
          <h1 className="text-xl font-bold tracking-wider text-soil-accent font-mono">
            Reset Password
          </h1>
        </div>
      </div>
    }>
      <ForgotPasswordForm />
    </Suspense>
  )
}
