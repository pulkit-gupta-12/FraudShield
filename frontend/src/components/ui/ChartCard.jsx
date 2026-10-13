import React from 'react'
import clsx from 'clsx'

/**
 * Container wrapper for data visualizations and charts.
 * 
 * @param {string} title
 * @param {string} [subtitle]
 * @param {React.ReactNode} [action]
 * @param {React.ReactNode} [legend]
 * @param {React.ReactNode} children
 */
export function ChartCard({
  title,
  subtitle,
  action,
  legend,
  children,
  className = '',
}) {
  return (
    <div
      className={clsx(
        'bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs flex flex-col justify-between',
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-sm font-bold text-neutral-900">{title}</h3>
          {subtitle && <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          {legend}
          {action}
        </div>
      </div>
      <div className="flex-1 w-full min-h-[220px]">{children}</div>
    </div>
  )
}
