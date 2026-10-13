import React from 'react'
import clsx from 'clsx'
import { Check } from 'lucide-react'

/**
 * Checkbox component
 * 
 * @param {boolean} checked
 * @param {(checked: boolean) => void} onChange
 * @param {string} [label]
 * @param {string} [description]
 */
export function Checkbox({
  checked = false,
  onChange,
  label,
  description,
  disabled = false,
  className = '',
}) {
  return (
    <label className={clsx('flex items-start gap-3 cursor-pointer select-none', disabled && 'opacity-50 cursor-not-allowed', className)}>
      <div className="relative flex items-center justify-center mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => !disabled && onChange && onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={clsx(
            'w-4 h-4 rounded-md border transition flex items-center justify-center',
            checked ? 'bg-primary border-primary text-white' : 'bg-white border-neutral-300 hover:border-neutral-400'
          )}
        >
          {checked && <Check className="w-3 h-3 stroke-[3]" />}
        </div>
      </div>
      {(label || description) && (
        <div className="flex flex-col">
          {label && <span className="text-sm font-medium text-neutral-800 leading-tight">{label}</span>}
          {description && <span className="text-xs text-neutral-500 mt-0.5">{description}</span>}
        </div>
      )}
    </label>
  )
}
