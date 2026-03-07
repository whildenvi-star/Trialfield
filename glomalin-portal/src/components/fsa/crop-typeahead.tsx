'use client'

import { useState, useEffect, useRef } from 'react'
import { FSA_CROP_LIST } from '@/lib/fsa/fsa-crop-list'

interface CropTypeaheadProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function CropTypeahead({ value, onChange, className }: CropTypeaheadProps) {
  const [options, setOptions] = useState<string[]>(FSA_CROP_LIST)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch farm-budget crops once on mount, merge with FSA list
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/fsa/auto-populate-preview', {
      signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : controller.signal,
    })
      .then((res) => {
        if (!res.ok) return
        return res.json()
      })
      .then((json) => {
        if (!json) return
        // Extract unique crop names from proposals
        const proposals = Array.isArray(json.proposals) ? json.proposals : []
        const farmCrops: string[] = proposals
          .map((p: { proposedCrop?: string | null }) => p.proposedCrop)
          .filter((c: unknown): c is string => typeof c === 'string' && c.trim().length > 0)

        // Merge and deduplicate with FSA list
        const merged = Array.from(new Set([...FSA_CROP_LIST, ...farmCrops])).sort()
        setOptions(merged)
      })
      .catch(() => {
        // Non-blocking — silently keep FSA_CROP_LIST
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

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      <input
        type="text"
        className="w-full bg-glomalin-bg border border-glomalin-border rounded px-3 py-2 font-mono text-sm text-glomalin-text focus:outline-none focus:border-glomalin-accent"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Type crop name..."
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-10 top-full left-0 right-0 mt-1 bg-glomalin-bg border border-glomalin-border rounded shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((opt) => (
            <li
              key={opt}
              className="px-3 py-2 font-mono text-sm text-glomalin-text cursor-pointer hover:bg-glomalin-surface"
              onMouseDown={(e) => {
                e.preventDefault()
                onChange(opt)
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
