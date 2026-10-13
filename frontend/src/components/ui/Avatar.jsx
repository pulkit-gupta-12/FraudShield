import React, { useState } from 'react'
import clsx from 'clsx'

/**
 * Avatar component with image fallback to initials or placeholder.
 * 
 * @param {string} [src]
 * @param {string} [name='User']
 * @param {'xs'|'sm'|'md'|'lg'|'xl'} [size='md']
 * @param {string} [status] - 'online' | 'busy' | 'offline'
 */
export function Avatar({
  src,
  name = 'User',
  size = 'md',
  status,
  className = '',
}) {
  const [imageError, setImageError] = useState(false)

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  }

  const getInitials = (n) => {
    if (!n) return '?'
    const parts = n.trim().split(' ')
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return n.slice(0, 2).toUpperCase()
  }

  const statusColors = {
    online: 'bg-safe-500',
    busy: 'bg-risk-500',
    offline: 'bg-neutral-400',
  }

  return (
    <div className={clsx('relative inline-block select-none shrink-0', className)}>
      <div
        className={clsx(
          'rounded-full overflow-hidden flex items-center justify-center font-bold border border-neutral-200/80 bg-primary-100 text-primary-700 shadow-xs',
          sizeClasses[size]
        )}
      >
        {src && !imageError ? (
          <img
            src={src}
            alt={name}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{getInitials(name)}</span>
        )}
      </div>

      {status && (
        <span
          className={clsx(
            'absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white',
            statusColors[status] || 'bg-neutral-400'
          )}
        />
      )}
    </div>
  )
}
