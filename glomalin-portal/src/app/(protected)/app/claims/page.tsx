import { redirect } from 'next/navigation'

export default function ClaimsRedirectPage() {
  redirect('/app/compliance?tab=claims')
}
