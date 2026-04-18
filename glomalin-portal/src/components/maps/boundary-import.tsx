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

export function BoundaryImport() {
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
      <div className="border border-[#2a2218] rounded bg-[#0e0c0b] p-6 max-w-xl">
        <h3 className="font-mono text-base text-[#C8860A] mb-2">
          Import Complete — Previous Boundaries Replaced
        </h3>
        <p className="text-[#6a5a4a] text-sm mb-5">
          All existing field boundaries were deleted and replaced with this upload.
        </p>

        <div className="space-y-2 mb-5">
          <div className="flex items-center gap-3 font-mono text-sm">
            <span className="text-[#6a5a4a] w-44">Matched &amp; Updated:</span>
            <span className="text-[#7A9E7E] tabular-nums">{result.matched} fields</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-sm">
            <span className="text-[#6a5a4a] w-44">Unmatched features:</span>
            <span className="text-[#e8d8c0] tabular-nums">{result.unmatched.length}</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-sm">
            <span className="text-[#6a5a4a] w-44">No boundary:</span>
            <span className="text-[#e8d8c0] tabular-nums">{result.noGeometry} registry fields</span>
          </div>
          {result.farmCenter && (
            <div className="flex items-center gap-3 font-mono text-sm">
              <span className="text-[#6a5a4a] w-44">Farm Center:</span>
              <span className="text-[#e8d8c0] tabular-nums">
                {result.farmCenter.lat.toFixed(6)}, {result.farmCenter.lng.toFixed(6)}{' '}
                <span className="text-[#6a5a4a]">(updated)</span>
              </span>
            </div>
          )}
        </div>

        {result.unmatched.length > 0 && (
          <div className="mb-5">
            <p className="font-mono text-xs text-[#6a5a4a] uppercase tracking-wider mb-2">
              Unmatched feature names
            </p>
            <ul className="space-y-1">
              {result.unmatched.map((name) => (
                <li key={name} className="font-mono text-sm text-[#e8d8c0]">
                  &bull; {name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.noGeometry > 0 && (
          <p className="font-mono text-sm text-[#6a5a4a] mb-5">
            {result.noGeometry} registry{' '}
            {result.noGeometry === 1 ? 'field has' : 'fields have'} no boundary in this import.
          </p>
        )}

        <button
          onClick={resetToIdle}
          className="bg-[#1a1510] border border-[#2a2218] text-[#e8d8c0] px-4 py-2 rounded font-mono text-sm hover:border-[#C8860A] transition-colors"
        >
          Import New Shapefile
        </button>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="border border-[#2a2218] rounded bg-[#0e0c0b] p-6 max-w-xl">
        <p className="font-mono text-sm text-red-400 mb-4">{errorMessage}</p>
        <button
          onClick={resetToIdle}
          className="bg-[#1a1510] border border-[#2a2218] text-[#e8d8c0] px-4 py-2 rounded font-mono text-sm hover:border-[#C8860A] transition-colors"
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
          'border-2 border-dashed rounded bg-[#0e0c0b] p-10 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-[#C8860A]'
            : 'border-[#2a2218] hover:border-[#3a3228]',
          isUploading ? 'animate-pulse cursor-not-allowed opacity-70' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <input {...getInputProps()} />

        {isUploading ? (
          <p className="font-mono text-sm text-[#6a5a4a]">Importing...</p>
        ) : isDragActive ? (
          <p className="font-mono text-sm text-[#C8860A]">Drop to upload</p>
        ) : (
          <>
            <p className="font-mono text-sm text-[#e8d8c0] mb-1">
              Drop shapefile .zip here
            </p>
            <p className="font-mono text-xs text-[#6a5a4a]">
              (SMS export: .shp + .dbf + .prj bundled as .zip)
            </p>
          </>
        )}
      </div>

      {!isUploading && (
        <div className="mt-3">
          <label className="inline-block bg-[#1a1510] border border-[#2a2218] text-[#e8d8c0] px-4 py-2 rounded font-mono text-sm hover:border-[#C8860A] transition-colors cursor-pointer">
            <input {...getInputProps()} className="sr-only" />
            Browse
          </label>
        </div>
      )}
    </div>
  )
}
