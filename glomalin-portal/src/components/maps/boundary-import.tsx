'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'

interface ImportResult {
  matched: number
  updated: number
  unmatched: string[]
  noGeometry: number
  farmCenter: { lat: number; lng: number } | null
}

type ImportStatus = 'idle' | 'uploading' | 'complete' | 'error'

export function BoundaryImport({ onSuccess }: { onSuccess?: () => void }) {
  const [status, setStatus] = useState<ImportStatus>('idle')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleDrop(files: File[]) {
    const file = files[0]
    if (!file) return
    if (!file.name.endsWith('.zip')) {
      setErrorMessage('Only .zip shapefile bundles are accepted')
      setStatus('error')
      return
    }
    setStatus('uploading')
    setResult(null)
    setErrorMessage(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/maps/import', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        setErrorMessage(data.error ?? 'Import failed')
        setStatus('error')
        return
      }
      setResult(data)
      setStatus('complete')
      onSuccess?.()
    } catch {
      setErrorMessage('Network error — import failed')
      setStatus('error')
    }
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    handleDrop(acceptedFiles)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/zip': ['.zip'] },
    maxFiles: 1,
    onDrop,
    disabled: status === 'uploading',
  })

  function resetToIdle() {
    setStatus('idle')
    setResult(null)
    setErrorMessage(null)
  }

  if (status === 'complete' && result) {
    return (
      <div className="border border-glomalin-canvas-border rounded bg-glomalin-canvas-surface p-6 max-w-xl">
        <h3 className="font-mono text-base text-glomalin-canvas-accent mb-2">
          Import Complete — Previous Boundaries Replaced
        </h3>
        <p className="text-glomalin-canvas-muted text-sm mb-5">
          All existing field boundaries were deleted and replaced with this upload.
        </p>

        <div className="space-y-2 mb-5">
          <div className="flex items-center gap-3 font-mono text-sm">
            <span className="text-glomalin-canvas-muted w-44">Matched &amp; Updated:</span>
            <span className="text-[#7A9E7E] tabular-nums">{result.matched} fields</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-sm">
            <span className="text-glomalin-canvas-muted w-44">Unmatched features:</span>
            <span className="text-glomalin-canvas-text tabular-nums">{result.unmatched.length}</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-sm">
            <span className="text-glomalin-canvas-muted w-44">No boundary:</span>
            <span className="text-glomalin-canvas-text tabular-nums">{result.noGeometry} registry fields</span>
          </div>
          {result.farmCenter && (
            <div className="flex items-center gap-3 font-mono text-sm">
              <span className="text-glomalin-canvas-muted w-44">Farm Center:</span>
              <span className="text-glomalin-canvas-text tabular-nums">
                {result.farmCenter.lat.toFixed(6)}, {result.farmCenter.lng.toFixed(6)}{' '}
                <span className="text-glomalin-canvas-muted">(updated)</span>
              </span>
            </div>
          )}
        </div>

        {result.unmatched.length > 0 && (
          <div className="mb-5">
            <p className="font-mono text-xs text-glomalin-canvas-muted uppercase tracking-wider mb-2">
              Unmatched feature names
            </p>
            <ul className="space-y-1">
              {result.unmatched.map((name) => (
                <li key={name} className="font-mono text-sm text-glomalin-canvas-text">
                  &bull; {name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.noGeometry > 0 && (
          <p className="font-mono text-sm text-glomalin-canvas-muted mb-5">
            {result.noGeometry} registry{' '}
            {result.noGeometry === 1 ? 'field has' : 'fields have'} no boundary in this import.
          </p>
        )}

        <button
          onClick={resetToIdle}
          className="bg-glomalin-canvas-elevated border border-glomalin-canvas-border text-glomalin-canvas-text px-4 py-2 rounded font-mono text-sm hover:border-glomalin-canvas-accent transition-colors"
        >
          Import New Shapefile
        </button>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="border border-glomalin-canvas-border rounded bg-glomalin-canvas-surface p-6 max-w-xl">
        <p className="font-mono text-sm text-red-400 mb-4">{errorMessage}</p>
        <button
          onClick={resetToIdle}
          className="bg-glomalin-canvas-elevated border border-glomalin-canvas-border text-glomalin-canvas-text px-4 py-2 rounded font-mono text-sm hover:border-glomalin-canvas-accent transition-colors"
        >
          Try Again
        </button>
      </div>
    )
  }

  const isUploading = status === 'uploading'

  return (
    <div className="max-w-xl">
      <div
        {...getRootProps()}
        className={[
          'border-2 border-dashed rounded bg-glomalin-canvas-surface p-10 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-glomalin-canvas-accent'
            : 'border-glomalin-canvas-border hover:border-[#3a3228]',
          isUploading ? 'animate-pulse cursor-not-allowed opacity-70' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <input {...getInputProps()} />

        {isUploading ? (
          <p className="font-mono text-sm text-glomalin-canvas-muted">Importing...</p>
        ) : isDragActive ? (
          <p className="font-mono text-sm text-glomalin-canvas-accent">Drop to upload</p>
        ) : (
          <>
            <p className="font-mono text-sm text-glomalin-canvas-text mb-1">
              Drop shapefile .zip here
            </p>
            <p className="font-mono text-xs text-glomalin-canvas-muted">
              (SMS export: .shp + .dbf + .prj bundled as .zip)
            </p>
          </>
        )}
      </div>

      {!isUploading && (
        <div className="mt-3">
          <label className="inline-block bg-glomalin-canvas-elevated border border-glomalin-canvas-border text-glomalin-canvas-text px-4 py-2 rounded font-mono text-sm hover:border-glomalin-canvas-accent transition-colors cursor-pointer">
            <input {...getInputProps()} className="sr-only" />
            Browse
          </label>
        </div>
      )}
    </div>
  )
}
