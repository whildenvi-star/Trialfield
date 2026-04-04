import { redirect } from 'next/navigation'

export default function InsuranceRedirectPage() {
  redirect('/app/compliance?tab=insurance')
}
