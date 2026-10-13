import React from 'react'
import clsx from 'clsx'

/**
 * Tabs navigation component
 * 
 * @param {Array<{id: string, label: string, icon?: React.ReactNode, count?: number}>} tabs
 * @param {string} activeTab
 * @param {(id: string) => void} onChange
 * @param {'pills'|'underline'} [variant='pills']
 */
export function Tabs({
  tabs = [],
  activeTab,
  onChange,
  variant = 'pills',
  className = '',
}) {
  return (
    <div
      className={clsx(
        variant === 'pills'
          ? 'inline-flex p-1 bg-neutral-100 rounded-xl gap-1'
          : 'flex border-b border-neutral-200 gap-6',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={clsx(
              'inline-flex items-center gap-2 text-xs font-semibold transition select-none',
              variant === 'pills'
                ? clsx(
                    'px-3.5 py-1.5 rounded-lg',
                    isActive
                      ? 'bg-white text-neutral-900 shadow-xs'
                      : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/50'
                  )
                : clsx(
                    'pb-3 pt-1 border-b-2 -mb-px',
                    isActive
                      ? 'border-primary text-primary-600'
                      : 'border-transparent text-neutral-500 hover:text-neutral-800'
                  )
            )}
          >
            {tab.icon && <span className="w-4 h-4">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.count != null && (
              <span
                className={clsx(
                  'px-1.5 py-0.2 rounded-full text-[10px] font-bold',
                  isActive ? 'bg-primary-50 text-primary-700' : 'bg-neutral-200 text-neutral-600'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
