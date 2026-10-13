import React, { useEffect } from 'react'
import clsx from 'clsx'
import { X } from 'lucide-react'

/**
 * Slide-over Drawer component from right side.
 * 
 * @param {boolean} isOpen
 * @param {() => void} onClose
 * @param {string} [title]
 * @param {string} [description]
 * @param {React.ReactNode} [footer]
 * @param {'sm'|'md'|'lg'} [size='md']
 * @param {React.ReactNode} children
 */
export function Drawer({
  isOpen,
  onClose,
  title,
  description,
  footer,
  size = 'md',
  children,
  className = '',
}) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-neutral-900/50 backdrop-blur-xs transition-opacity"
          onClick={onClose}
        />

        <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
          <div
            className={clsx(
              'pointer-events-auto w-screen bg-white shadow-2xl flex flex-col justify-between border-l border-neutral-200 animate-in slide-in-from-right duration-200',
              sizeClasses[size],
              className
            )}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
              <div>
                {title && <h3 className="text-base font-bold text-neutral-900">{title}</h3>}
                {description && <p className="text-xs text-neutral-500 mt-0.5">{description}</p>}
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition"
                title="Close drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6">{children}</div>

            {/* Footer */}
            {footer && (
              <div className="p-4 border-t border-neutral-100 bg-neutral-50 flex items-center justify-end gap-3">
                {footer}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
