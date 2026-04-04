import { redirect } from 'next/navigation'

export default function FsaRedirectPage() {
  redirect('/app/compliance?tab=acreage')
}
