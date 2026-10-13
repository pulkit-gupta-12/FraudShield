import React from 'react'
import clsx from 'clsx'

/**
 * PageHeader banner with title, subtitle, breadcrumb, and action buttons.
 * 
 * @param {string} title
 * @param {string} [description]
 * @param {React.ReactNode} [actions]
 * @param {React.ReactNode} [badge]
 */
export function PageHeader({
  title,
  description,
  actions,
  badge,
  className = '',
}) {
  return (
    <div
      className={clsx(
        'flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-200/80 mb-6',
        className
      )}
    >
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight">{title}</h1>
          {badge && <div>{badge}</div>}
        </div>
        {description && <p className="text-xs sm:text-sm text-neutral-500 mt-1 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2.5 shrink-0">{actions}</div>}
    </div>
  )
}
