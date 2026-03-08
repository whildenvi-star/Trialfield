'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    redirect('/login?error=invalid')
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

export async function resetPassword(formData: FormData) {
  const email = formData.get('email') as string

  const headersList = await headers()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || headersList.get('origin') || headersList.get('host') || 'http://localhost:3000'
  const redirectTo = siteUrl.startsWith('http') ? `${siteUrl}/auth/callback` : `https://${siteUrl}/auth/callback`

  const supabase = await createClient()

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  })

  // Do NOT reveal whether the email exists — always redirect to sent confirmation
  redirect('/forgot-password?sent=true')
}
