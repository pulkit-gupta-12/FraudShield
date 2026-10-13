import React from 'react'
import clsx from 'clsx'

/**
 * Textarea component
 * 
 * @param {string} [label]
 * @param {string} [error]
 * @param {string} [helperText]
 */
export function Textarea({
  label,
  error,
  helperText,
  id,
  rows = 3,
  className = '',
  ...props
}) {
  const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={textareaId} className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        rows={rows}
        className={clsx(
          'w-full text-sm rounded-xl border bg-white text-neutral-900 transition p-3 placeholder-neutral-400',
          'focus:outline-none focus:ring-2 focus:ring-offset-0',
          error
            ? 'border-risk-400 focus:border-risk-500 focus:ring-risk-200'
            : 'border-neutral-300 focus:border-primary-500 focus:ring-primary-100',
          className
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-risk-600">{error}</p>}
      {!error && helperText && <p className="mt-1 text-xs text-neutral-500">{helperText}</p>}
    </div>
  )
}
