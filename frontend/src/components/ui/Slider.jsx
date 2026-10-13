import React from 'react'
import clsx from 'clsx'

/**
 * Range Slider component with value display
 * 
 * @param {string} [label]
 * @param {number} value
 * @param {number} [min=0]
 * @param {number} [max=100]
 * @param {number} [step=1]
 * @param {(value: number) => void} onChange
 * @param {(value: number) => string} [formatValue]
 */
export function Slider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  formatValue = (v) => v,
  className = '',
  disabled = false,
}) {
  return (
    <div className={clsx('w-full', className)}>
      <div className="flex items-center justify-between mb-2">
        {label && (
          <label className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">
            {label}
          </label>
        )}
        <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2.5 py-0.5 rounded-full border border-primary-200">
          {formatValue(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange && onChange(Number(e.target.value))}
        className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none focus:ring-2 focus:ring-primary-500/20"
      />
      <div className="flex justify-between text-[11px] text-neutral-400 mt-1">
        <span>{formatValue(min)}</span>
        <span>{formatValue(max)}</span>
      </div>
    </div>
  )
}
