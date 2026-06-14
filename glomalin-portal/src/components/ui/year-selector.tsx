'use client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { CURRENT_CROP_YEAR } from '@/lib/config'

interface YearSelectorProps {
  currentYear: number
  availableYears?: number[]
}

export function YearSelector({ currentYear, availableYears }: YearSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const years = availableYears ?? [
    CURRENT_CROP_YEAR,
    CURRENT_CROP_YEAR - 1,
    CURRENT_CROP_YEAR - 2,
  ]

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('year', e.target.value)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-mono text-glomalin-muted">Year:</span>
      <select
        value={currentYear}
        onChange={handleChange}
        className="text-xs font-mono px-2 py-1 bg-[#080a0f] border border-glomalin-border text-glomalin-text rounded focus:outline-none focus:ring-1 focus:ring-glomalin-accent cursor-pointer"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  )
}
