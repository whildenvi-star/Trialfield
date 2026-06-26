import { MarketingNav } from '@/components/marketing/marketing-nav'

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-0 min-h-0">
      <MarketingNav />
      <div className="flex-1 min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
