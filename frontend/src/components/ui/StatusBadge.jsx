import React from 'react'
import clsx from 'clsx'

/**
 * General status badge for workflow items (cases, cards, transactions)
 * 
 * @param {string} status
 * @param {'neutral'|'success'|'warning'|'danger'|'primary'} [variant]
 */
export function StatusBadge({ status, variant, className = '' }) {
  const norm = String(status || '').toLowerCase()

  let chosenVariant = variant
  if (!chosenVariant) {
    if (['approved', 'active', 'resolved', 'closed', 'success', 'won'].includes(norm)) {
      chosenVariant = 'success'
    } else if (['under review', 'in review', 'pending', 'investigating', 'open'].includes(norm)) {
      chosenVariant = 'warning'
    } else if (['blocked', 'fraud', 'failure', 'rejected', 'lost', 'suspended'].includes(norm)) {
      chosenVariant = 'danger'
    } else {
      chosenVariant = 'neutral'
    }
  }

  const variants = {
    neutral: 'bg-neutral-100 text-neutral-700 border-neutral-200',
    success: 'bg-safe-50 text-safe-700 border-safe-200',
    warning: 'bg-review-50 text-review-700 border-review-200',
    danger: 'bg-risk-50 text-risk-700 border-risk-200',
    primary: 'bg-primary-50 text-primary-700 border-primary-200',
  }

  const dotColors = {
    neutral: 'bg-neutral-400',
    success: 'bg-safe-500',
    warning: 'bg-review-500',
    danger: 'bg-risk-500',
    primary: 'bg-primary-500',
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border select-none',
        variants[chosenVariant],
        className
      )}
    >
      <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', dotColors[chosenVariant])} />
      <span>{status}</span>
    </span>
  )
}
