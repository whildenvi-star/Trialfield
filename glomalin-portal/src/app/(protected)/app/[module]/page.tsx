import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MODULES, getEmbedUrl } from '@/lib/modules'
import { EmbedFrame } from '@/components/embed-frame'
import { EmbedBreadcrumb } from '@/components/embed-breadcrumb'

interface ModulePageProps {
  params: Promise<{ module: string }>
}

export default async function ModulePage({ params }: ModulePageProps) {
  const { module: moduleSlug } = await params

  // Look up the module by matching the slug against each module's id
  const mod = MODULES.find((m) => m.id === moduleSlug)

  // Return 404 for any unrecognized module slug
  if (!mod) {
    notFound()
  }

  // Embedded module: render iframe
  if (mod.type === 'embed') {
    const embedUrl = getEmbedUrl(mod)

    if (!embedUrl) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <h1 className="text-xl font-bold font-mono text-glomalin-text">
            {mod.label}
          </h1>
          <p className="text-glomalin-muted font-mono text-sm mt-2">
            Embed URL not configured. Set NEXT_PUBLIC_EMBED_URL_{mod.embedKey} in .env.local
          </p>
          <div className="mt-8">
            <Link
              href="/dashboard"
              className="text-sm font-mono text-glomalin-muted hover:text-glomalin-accent transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      )
    }

    return (
      <>
        <EmbedBreadcrumb moduleLabel={mod.label} moduleSublabel={mod.sublabel} />
        <EmbedFrame src={embedUrl} title={mod.label} />
      </>
    )
  }

  // Coming Soon fallback for modules not yet built
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      {/* Module placeholder icon */}
      <svg
        className="w-16 h-16 text-glomalin-border mb-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
        />
      </svg>

      {/* Module name */}
      <h1 className="text-3xl font-bold font-mono text-glomalin-text tracking-wide">
        {mod.label}
      </h1>

      {/* Module sublabel */}
      <p className="text-lg text-glomalin-muted font-mono mt-2">{mod.sublabel}</p>

      {/* Divider */}
      <div className="w-16 h-px bg-glomalin-border my-6" />

      {/* Coming Soon badge */}
      <span className="text-sm font-mono text-glomalin-accent uppercase tracking-widest border border-glomalin-accent/30 rounded-full px-4 py-1.5">
        Coming Soon
      </span>

      {/* Back link */}
      <div className="mt-8">
        <Link
          href="/dashboard"
          className="text-sm font-mono text-glomalin-muted hover:text-glomalin-accent transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
