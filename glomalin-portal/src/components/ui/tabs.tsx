'use client'

import { cn } from '@/lib/utils'

interface Tab<T extends string = string> {
  id: T
  label: string
  disabled?: boolean
}

interface TabsProps<T extends string = string> {
  tabs: Tab<T>[]
  active: T
  onChange: (id: T) => void
  className?: string
  size?: 'sm' | 'md'
}

export function Tabs<T extends string = string>({
  tabs,
  active,
  onChange,
  className,
  size = 'md',
}: TabsProps<T>) {
  return (
    <div
      className={cn(
        'flex gap-0 border-b border-glomalin-border',
        className
      )}
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          disabled={tab.disabled}
          onClick={() => !tab.disabled && onChange(tab.id)}
          className={cn(
            'font-mono transition-colors border-b-2 -mb-px',
            size === 'md' ? 'px-5 py-2.5 text-sm' : 'px-4 py-2 text-xs',
            active === tab.id
              ? 'border-glomalin-accent text-glomalin-accent'
              : 'border-transparent text-glomalin-muted hover:text-glomalin-text',
            tab.disabled && 'cursor-not-allowed opacity-40 hover:text-glomalin-muted'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
