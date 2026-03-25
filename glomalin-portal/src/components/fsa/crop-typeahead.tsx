'use client'

import { useState, useEffect, useRef } from 'react'
import { FSA_LAND_USE_CATEGORIES } from '@/lib/fsa/fsa-crop-list'

interface CropRecord {
  id: string
  name: string
  organic: boolean
  category?: string
}

interface CropTypeaheadProps {
  value: string
  onChange: (value: string, registryCropId?: string) => void
  className?: string
}

export function CropTypeahead({ value, onChange, className }: CropTypeaheadProps) {
  const [options, setOptions] = useState<string[]>([])
  const [cropRecords, setCropRecords] = useState<CropRecord[]>([])
  const [loadError, setLoadError] = useState(false)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch registry crop list on mount — no local fallback per user decision
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/registry/crops-autocomplete', {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error('Registry unavailable')
        return res.json()
      })
      .then((crops: CropRecord[]) => {
        setCropRecords(crops)
        // Build display options: organic crops prefixed with "Organic ",
        // plus FSA land-use categories (not in registry) appended at end
        const cropNames = crops
          .map((c) => (c.organic ? `Organic ${c.name}` : c.name))
          .sort()
        const all = Array.from(new Set([...cropNames, ...FSA_LAND_USE_CATEGORIES])).sort()
        setOptions(all)
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setLoadError(true)
        }
      })

    return () => controller.abort()
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = value.trim()
    ? options
        .filter((opt) => opt.toLowerCase().startsWith(value.toLowerCase()))
        .slice(0, 10)
    : options.slice(0, 10)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  /** Resolve registryCropId for a selected display name. */
  function resolveRegistryCropId(displayName: string): string | undefined {
    // Strip "Organic " prefix if present
    const baseName = displayName.startsWith('Organic ')
      ? displayName.slice('Organic '.length)
      : displayName
    // Find matching crop record by name (also match organic flag)
    const isOrganic = displayName.startsWith('Organic ')
    const record = cropRecords.find(
      (c) => c.name === baseName && c.organic === isOrganic
    )
    return record?.id
  }

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      <input
        type="text"
        className={`w-full bg-glomalin-bg border border-glomalin-border rounded px-3 py-2 font-mono text-sm text-glomalin-text focus:outline-none focus:border-glomalin-accent ${loadError ? 'border-red-500' : ''}`}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={loadError ? 'Registry unavailable' : 'Type crop name...'}
        autoComplete="off"
      />
      {loadError && (
        <p className="mt-1 text-xs text-red-400 font-mono">
          Crop registry unavailable — check farm-registry service
        </p>
      )}
      {open && filtered.length > 0 && !loadError && (
        <ul className="absolute z-10 top-full left-0 right-0 mt-1 bg-glomalin-bg border border-glomalin-border rounded shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((opt) => (
            <li
              key={opt}
              className="px-3 py-2 font-mono text-sm text-glomalin-text cursor-pointer hover:bg-glomalin-surface"
              onMouseDown={(e) => {
                e.preventDefault()
                const registryCropId = resolveRegistryCropId(opt)
                onChange(opt, registryCropId)
                setOpen(false)
              }}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
