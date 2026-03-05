import Link from 'next/link'
import FarmNodeMap from '@/components/farm-node-map'

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-soil-bg">
      {/* Header bar */}
      <div className="relative flex items-center justify-between px-8 pt-8 pb-4 flex-shrink-0">
        <div>
          <h1 className="text-5xl font-bold tracking-widest text-soil-accent font-mono">
            GLOMALIN
          </h1>
          <p className="text-soil-muted text-sm font-mono mt-1">
            Farm Operations Portal
          </p>
        </div>
        <Link
          href="/login"
          className="text-soil-muted hover:text-soil-accent font-mono text-sm transition-colors duration-150"
        >
          Sign In
        </Link>
      </div>

      {/* Node map fills remaining viewport space */}
      <div className="flex-1 min-h-[600px]">
        <FarmNodeMap />
      </div>
    </div>
  )
}
