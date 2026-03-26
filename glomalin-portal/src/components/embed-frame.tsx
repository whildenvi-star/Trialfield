'use client'

import { useState, useEffect, useRef } from 'react'

interface EmbedFrameProps {
  src: string
  title: string
}

function getCurrentTheme(): string {
  if (typeof window === 'undefined') return 'dark'
  return localStorage.getItem('mru-theme') === 'light' ? 'light' : 'dark'
}

export function EmbedFrame({ src, title }: EmbedFrameProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  function sendThemeToIframe(theme: string) {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'glomalin-theme', theme },
      '*'
    )
  }

  // Push current theme as soon as the iframe finishes loading
  function handleLoad() {
    setLoading(false)
    sendThemeToIframe(getCurrentTheme())
  }

  useEffect(() => {
    // Listen for storage events (portal settings-panel writes mru-theme)
    function onStorage(e: StorageEvent) {
      if (e.key === 'mru-theme') {
        sendThemeToIframe(e.newValue === 'light' ? 'light' : 'dark')
      }
    }

    // Listen for custom theme-change event dispatched by settings-panel.js
    function onThemeChange() {
      sendThemeToIframe(getCurrentTheme())
    }

    window.addEventListener('storage', onStorage)
    window.addEventListener('theme-change', onThemeChange)

    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('theme-change', onThemeChange)
    }
  }, [])

  return (
    <div className="fixed left-0 right-0 bottom-0" style={{ top: 'calc(var(--portal-header-h, 56px) + var(--embed-breadcrumb-h, 36px))' }}>
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
        ref={iframeRef}
        src={src}
        title={title}
        className="w-full h-full border-0"
        onLoad={handleLoad}
        onError={() => {
          setLoading(false)
          setError(true)
        }}
      />
    </div>
  )
}
