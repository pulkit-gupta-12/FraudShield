import React from 'react'
import clsx from 'clsx'
import { Clock } from 'lucide-react'
import { formatRelativeTime, formatDate } from '../../utils/format.js'

/**
 * Audit / Case investigation timeline component.
 * 
 * @param {Array<{id: string, timestamp: string, action: string, user?: string, note?: string}>} items
 */
export function Timeline({ items = [], className = '' }) {
  if (!items || items.length === 0) {
    return <p className="text-xs text-neutral-400 italic">No timeline events recorded.</p>
  }

  return (
    <div className={clsx('flow-root', className)}>
      <ul className="-mb-8">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1
          return (
            <li key={item.id || idx}>
              <div className="relative pb-8">
                {!isLast && (
                  <span
                    className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-neutral-200"
                    aria-hidden="true"
                  />
                )}
                <div className="relative flex items-start space-x-3">
                  <div className="relative">
                    <div className="h-8 w-8 rounded-full bg-primary-50 border border-primary-200 flex items-center justify-center ring-4 ring-white">
                      <Clock className="h-4 w-4 text-primary-600" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                    <div>
                      <p className="text-xs font-bold text-neutral-900">{item.action}</p>
                      {item.note && <p className="text-xs text-neutral-600 mt-0.5">{item.note}</p>}
                      {item.user && (
                        <p className="text-[11px] text-neutral-400 mt-1 font-medium">By {item.user}</p>
                      )}
                    </div>
                    <div className="text-right whitespace-nowrap text-[11px] text-neutral-400">
                      <span>{formatRelativeTime(item.timestamp)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
