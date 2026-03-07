'use client'

import { useState } from 'react'

interface EmbedFrameProps {
  src: string
  title: string
}

export function EmbedFrame({ src, title }: EmbedFrameProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  return (
    <div className="fixed top-14 left-0 right-0 bottom-0">
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-glomalin-bg">
          <p className="text-glomalin-muted font-mono text-sm animate-pulse">
            Loading {title}…
          </p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-glomalin-bg gap-4">
          <p className="text-glomalin-muted font-mono text-sm">
            Could not connect to {title}
          </p>
          <p className="text-glomalin-muted font-mono text-xs">
            Make sure the service is running at {src}
          </p>
          <button
            onClick={() => {
              setError(false)
              setLoading(true)
            }}
            className="text-glomalin-accent font-mono text-sm underline"
          >
            Retry
          </button>
        </div>
      )}

      <iframe
        src={src}
        title={title}
        className="w-full h-full border-0"
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false)
          setError(true)
        }}
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
      />
    </div>
  )
}
