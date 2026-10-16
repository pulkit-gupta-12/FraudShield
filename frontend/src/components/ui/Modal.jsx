import React, { useEffect } from 'react'
import clsx from 'clsx'
import { X } from 'lucide-react'

/**
 * Modal overlay component with backdrop and ESC key listener.
 * 
 * @param {boolean} isOpen
 * @param {() => void} onClose
 * @param {string} [title]
 * @param {string} [description]
 * @param {React.ReactNode} [footer]
 * @param {'sm'|'md'|'lg'|'xl'} [size='md']
 * @param {React.ReactNode} children
 */
export function Modal({
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
    xl: 'max-w-4xl',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog Box */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Modal dialog'}
        className={clsx(
          'relative w-full bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150',
          sizeClasses[size],
          className
        )}
      >
        {(title || description) && (
          <div className="px-6 py-4 border-b border-neutral-100 flex items-start justify-between gap-4">
            <div>
              {title && <h3 className="text-base font-bold text-neutral-900">{title}</h3>}
              {description && <p className="text-xs text-neutral-500 mt-0.5">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="p-6 max-h-[75vh] overflow-y-auto">{children}</div>

        {footer && (
          <div className="px-6 py-3.5 bg-neutral-50 border-t border-neutral-100 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
