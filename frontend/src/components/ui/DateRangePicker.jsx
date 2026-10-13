import React, { useState } from 'react'
import clsx from 'clsx'
import { Calendar } from 'lucide-react'

/**
 * DateRangePicker with preset buttons (Today, 7D, 30D, All).
 * 
 * @param {string} [value='30d']
 * @param {(preset: string) => void} onChange
 */
export function DateRangePicker({
  value = '30d',
  onChange,
  className = '',
}) {
  const presets = [
    { id: 'today', label: 'Today' },
    { id: '7d', label: 'Last 7 Days' },
    { id: '30d', label: 'Last 30 Days' },
    { id: '90d', label: 'Last 90 Days' },
    { id: 'all', label: 'All Time' },
  ]

  return (
    <div className={clsx('inline-flex items-center p-1 bg-neutral-100 rounded-xl gap-0.5', className)}>
      <div className="pl-2 pr-1 text-neutral-400">
        <Calendar className="w-3.5 h-3.5" />
      </div>
      {presets.map((p) => {
        const isSelected = value === p.id
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange && onChange(p.id)}
            className={clsx(
              'px-2.5 py-1 text-xs font-semibold rounded-lg transition select-none',
              isSelected
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/60'
            )}
          >
            {p.label}
          </button>
        )
      })}
    </div>
  )
}
