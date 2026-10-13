import React from 'react'
import clsx from 'clsx'
import { Filter, RotateCcw } from 'lucide-react'

/**
 * FilterBar toolbar component for search and filter widgets.
 * 
 * @param {() => void} [onReset]
 * @param {boolean} [showReset=false]
 * @param {React.ReactNode} children
 */
export function FilterBar({
  onReset,
  showReset = false,
  children,
  className = '',
}) {
  return (
    <div
      className={clsx(
        'bg-white p-3.5 rounded-2xl border border-neutral-200 shadow-xs flex flex-wrap items-center justify-between gap-3',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-3 flex-1">{children}</div>
      {showReset && (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset Filters
        </button>
      )}
    </div>
  )
}
