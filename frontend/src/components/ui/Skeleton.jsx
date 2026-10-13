import React from 'react'
import clsx from 'clsx'

/**
 * Skeleton placeholder loader component.
 * 
 * @param {'text'|'circular'|'rectangular'|'card'} [variant='text']
 * @param {string|number} [width]
 * @param {string|number} [height]
 */
export function Skeleton({
  variant = 'text',
  width,
  height,
  className = '',
}) {
  const style = {
    width: width != null ? (typeof width === 'number' ? `${width}px` : width) : undefined,
    height: height != null ? (typeof height === 'number' ? `${height}px` : height) : undefined,
  }

  const base = 'animate-pulse bg-neutral-200/80'

  if (variant === 'circular') {
    return (
      <div
        className={clsx(base, 'rounded-full shrink-0', className)}
        style={{ width: width || '40px', height: height || '40px', ...style }}
      />
    )
  }

  if (variant === 'rectangular') {
    return <div className={clsx(base, 'rounded-xl', className)} style={style} />
  }

  if (variant === 'card') {
    return (
      <div className={clsx('bg-white p-5 rounded-2xl border border-neutral-200 space-y-4 animate-pulse', className)}>
        <div className="h-4 bg-neutral-200 rounded-md w-1/3" />
        <div className="h-8 bg-neutral-200 rounded-md w-1/2" />
        <div className="h-3 bg-neutral-200 rounded-md w-3/4" />
      </div>
    )
  }

  // text variant
  return (
    <div
      className={clsx(base, 'rounded-md h-3.5 my-1', className)}
      style={{ width: width || '100%', ...style }}
    />
  )
}
