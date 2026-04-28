import { redirect } from 'next/navigation'

// Sales & Marketing has moved into the Macro Roll-Up tab.
export default function MarketingPage() {
  redirect('/app/macro-rollup')
}
