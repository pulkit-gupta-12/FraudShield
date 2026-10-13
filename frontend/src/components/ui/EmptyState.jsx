import React from 'react'
import clsx from 'clsx'
import { Inbox } from 'lucide-react'

/**
 * EmptyState placeholder component.
 * 
 * @param {string} [title='No data found']
 * @param {string} [description]
 * @param {React.ReactNode} [icon]
 * @param {React.ReactNode} [action]
 */
export function EmptyState({
  title = 'No data available',
  description = 'There are no records matching your current filter criteria or search query.',
  icon,
  action,
  className = '',
}) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border-2 border-dashed border-neutral-200 bg-white/50',
        className
      )}
    >
      <div className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mb-3">
        {icon || <Inbox className="w-6 h-6 stroke-[1.5]" />}
      </div>
      <h4 className="text-sm font-bold text-neutral-900">{title}</h4>
      {description && <p className="text-xs text-neutral-500 max-w-sm mt-1 leading-relaxed">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
