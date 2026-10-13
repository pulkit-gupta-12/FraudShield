import React from 'react'
import clsx from 'clsx'

/**
 * Text Input component
 * 
 * @param {string} [label]
 * @param {string} [error]
 * @param {string} [helperText]
 * @param {React.ReactNode} [leftIcon]
 * @param {React.ReactNode} [rightIcon]
 */
export function Input({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  id,
  className = '',
  ...props
}) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
            {leftIcon}
          </div>
        )}
        <input
          id={inputId}
          className={clsx(
            'w-full text-sm rounded-xl border bg-white text-neutral-900 transition py-2 placeholder-neutral-400',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            leftIcon ? 'pl-9' : 'pl-3.5',
            rightIcon ? 'pr-9' : 'pr-3.5',
            error
              ? 'border-risk-400 focus:border-risk-500 focus:ring-risk-200 text-risk-900'
              : 'border-neutral-300 focus:border-primary-500 focus:ring-primary-100',
            className
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-neutral-400">
            {rightIcon}
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-risk-600">{error}</p>}
      {!error && helperText && <p className="mt-1 text-xs text-neutral-500">{helperText}</p>}
    </div>
  )
}
