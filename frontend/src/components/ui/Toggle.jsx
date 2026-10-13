import React from 'react'
import clsx from 'clsx'

/**
 * Toggle Switch component
 * 
 * @param {boolean} checked
 * @param {(checked: boolean) => void} onChange
 * @param {string} [label]
 * @param {string} [description]
 */
export function Toggle({
  checked = false,
  onChange,
  label,
  description,
  disabled = false,
  className = '',
}) {
  return (
    <label className={clsx('flex items-center justify-between cursor-pointer group', disabled && 'opacity-50 cursor-not-allowed', className)}>
      {(label || description) && (
        <div className="flex flex-col pr-4">
          {label && <span className="text-sm font-medium text-neutral-900 group-hover:text-primary-600 transition">{label}</span>}
          {description && <span className="text-xs text-neutral-500">{description}</span>}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange && onChange(!checked)}
        className={clsx(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
          checked ? 'bg-primary' : 'bg-neutral-200'
        )}
      >
        <span
          className={clsx(
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out',
            checked ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    </label>
  )
}
