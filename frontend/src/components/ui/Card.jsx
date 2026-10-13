import React from 'react'
import clsx from 'clsx'

/**
 * Surface Card component with optional header, footer, and action slots.
 * 
 * @param {string} [title]
 * @param {string} [subtitle]
 * @param {React.ReactNode} [action]
 * @param {React.ReactNode} [footer]
 * @param {React.ReactNode} children
 */
export function Card({
  title,
  subtitle,
  action,
  footer,
  children,
  className = '',
  bodyClassName = '',
  ...props
}) {
  return (
    <div
      className={clsx(
        'bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden transition-all',
        className
      )}
      {...props}
    >
      {(title || subtitle || action) && (
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between gap-4">
          <div>
            {title && <h3 className="text-sm font-bold text-neutral-900">{title}</h3>}
            {subtitle && <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={clsx('p-5', bodyClassName)}>{children}</div>
      {footer && (
        <div className="px-5 py-3.5 bg-neutral-50/50 border-t border-neutral-100 text-xs text-neutral-500">
          {footer}
        </div>
      )}
    </div>
  )
}
