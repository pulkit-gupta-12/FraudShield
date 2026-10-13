import React from 'react'
import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'

/**
 * Select dropdown component
 * 
 * @param {string} [label]
 * @param {string} [error]
 * @param {Array<{label: string, value: any}>} [options=[]]
 */
export function Select({
  label,
  error,
  options = [],
  id,
  children,
  className = '',
  ...props
}) {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          className={clsx(
            'w-full text-sm rounded-xl border bg-white text-neutral-900 transition py-2 pl-3.5 pr-9 appearance-none',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            error
              ? 'border-risk-400 focus:border-risk-500 focus:ring-risk-200'
              : 'border-neutral-300 focus:border-primary-500 focus:ring-primary-100',
            className
          )}
          {...props}
        >
          {options.length > 0
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-neutral-400">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-risk-600">{error}</p>}
    </div>
  )
}
