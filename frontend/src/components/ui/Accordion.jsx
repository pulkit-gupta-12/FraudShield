import React, { useState } from 'react'
import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'

/**
 * Accordion component for collapsible content sections.
 * 
 * @param {Array<{id: string, title: string, subtitle?: string, content: React.ReactNode}>} items
 * @param {boolean} [allowMultiple=false]
 */
export function Accordion({ items = [], allowMultiple = false, className = '' }) {
  const [openItems, setOpenItems] = useState([items[0]?.id])

  const toggleItem = (id) => {
    if (allowMultiple) {
      setOpenItems((prev) =>
        prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      )
    } else {
      setOpenItems((prev) => (prev.includes(id) ? [] : [id]))
    }
  }

  return (
    <div className={clsx('divide-y divide-neutral-200 border border-neutral-200 rounded-2xl overflow-hidden bg-white shadow-xs', className)}>
      {items.map((item) => {
        const isOpen = openItems.includes(item.id)

        return (
          <div key={item.id} className="transition">
            <button
              type="button"
              onClick={() => toggleItem(item.id)}
              className="w-full py-4 px-5 text-left flex items-center justify-between gap-4 hover:bg-neutral-50 transition select-none"
            >
              <div>
                <span className="text-sm font-bold text-neutral-900 block">{item.title}</span>
                {item.subtitle && <span className="text-xs text-neutral-500 block mt-0.5">{item.subtitle}</span>}
              </div>
              <ChevronDown
                className={clsx(
                  'w-4 h-4 text-neutral-400 transition-transform duration-200 shrink-0',
                  isOpen ? 'rotate-180 text-primary-600' : ''
                )}
              />
            </button>
            {isOpen && (
              <div className="px-5 pb-4 pt-1 text-xs text-neutral-600 leading-relaxed border-t border-neutral-100/60 bg-neutral-50/30">
                {item.content}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
