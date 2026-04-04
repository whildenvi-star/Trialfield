'use client'

import React from 'react'

interface ActionButtonProps {
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md'
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
}

const variantStyles: Record<NonNullable<ActionButtonProps['variant']>, string> = {
  primary: 'bg-glomalin-accent text-black hover:bg-amber-500',
  secondary:
    'border border-glomalin-border text-glomalin-text hover:border-glomalin-accent hover:text-glomalin-accent',
  danger: 'border border-red-800 text-red-400 hover:bg-red-950',
}

const sizeStyles: Record<NonNullable<ActionButtonProps['size']>, string> = {
  sm: 'px-3 py-1 text-xs',
  md: 'px-4 py-2 text-sm',
}

export function ActionButton({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  disabled = false,
  type = 'button',
}: ActionButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[
        'font-mono rounded transition-colors',
        variantStyles[variant],
        sizeStyles[size],
        disabled ? 'opacity-40 cursor-not-allowed' : '',
      ]
        .join(' ')
        .trim()}
    >
      {children}
    </button>
  )
}
