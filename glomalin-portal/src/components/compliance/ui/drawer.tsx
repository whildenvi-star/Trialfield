'use client'

import React, { useEffect } from 'react'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  width?: 'sm' | 'md' | 'lg'
}

const widthStyles: Record<NonNullable<DrawerProps['width']>, string> = {
  sm: 'w-80',
  md: 'w-[480px]',
  lg: 'w-[640px]',
}

export function Drawer({ open, onClose, title, children, width = 'md' }: DrawerProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/60 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {/* Panel */}
      <div
        className={[
          'fixed right-0 top-0 h-full bg-glomalin-surface border-l border-glomalin-border overflow-y-auto',
          'transition-transform duration-200',
          widthStyles[width],
          open ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-glomalin-border">
          <h2 className="font-mono text-glomalin-text font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="text-glomalin-muted hover:text-glomalin-text font-mono text-lg leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        {/* Content */}
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
