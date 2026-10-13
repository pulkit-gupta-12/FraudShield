import React from 'react'
import clsx from 'clsx'

/**
 * Button component with variant, size, and loading states.
 * 
 * @param {'primary'|'secondary'|'danger'|'ghost'} [variant='primary']
 * @param {'sm'|'md'|'lg'} [size='md']
 * @param {boolean} [loading=false]
 * @param {boolean} [disabled=false]
 * @param {React.ReactNode} [icon]
 * @param {React.ReactNode} children
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon = null,
  children,
  className = '',
  ...props
}) {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-xl transition duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none'

  const variants = {
    primary: 'bg-primary text-white hover:bg-primary-700 focus:ring-primary-500 shadow-xs',
    secondary: 'bg-white text-neutral-700 border border-neutral-300 hover:bg-neutral-50 hover:border-neutral-400 focus:ring-neutral-400 shadow-xs',
    danger: 'bg-risk text-white hover:bg-risk-700 focus:ring-risk-500 shadow-xs',
    ghost: 'bg-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 focus:ring-neutral-300',
  }

  const sizes = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-6 py-2.5 gap-2.5',
  }

  return (
    <button
      disabled={disabled || loading}
      className={clsx(baseClasses, variants[variant], sizes[size], className)}
      {...props}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
      )}
      {!loading && icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  )
}
