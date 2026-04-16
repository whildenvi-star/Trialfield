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

function getCurrentScale(): string {
  if (typeof window === 'undefined') return '1'
  return localStorage.getItem('mru-text-scale') ?? '1'
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

  function sendScaleToIframe(scale: string) {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'glomalin-scale', scale },
      '*'
    )
  }

  // Push current theme + scale as soon as the iframe finishes loading
  function handleLoad() {
    setLoading(false)
    sendThemeToIframe(getCurrentTheme())
    sendScaleToIframe(getCurrentScale())
  }

  useEffect(() => {
    // Listen for custom theme-change event dispatched by settings-panel.js
    function onThemeChange() {
      sendThemeToIframe(getCurrentTheme())
    }

    // Listen for custom text-scale-change event dispatched by settings-panel.js
    function onScaleChange(e: Event) {
      const scale = (e as CustomEvent<{ scale: string }>).detail?.scale ?? getCurrentScale()
      sendScaleToIframe(scale)
    }

    window.addEventListener('theme-change', onThemeChange)
    window.addEventListener('text-scale-change', onScaleChange)

    return () => {
      window.removeEventListener('theme-change', onThemeChange)
      window.removeEventListener('text-scale-change', onScaleChange)
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
