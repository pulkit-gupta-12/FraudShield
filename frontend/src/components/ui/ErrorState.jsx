import React from 'react'
import clsx from 'clsx'
import { AlertCircle, RotateCcw } from 'lucide-react'
import { Button } from './Button.jsx'

/**
 * ErrorState display with retry button.
 * 
 * @param {string} [title='Failed to load data']
 * @param {string} [message='An error occurred while communicating with the service.']
 * @param {() => void} [onRetry]
 */
export function ErrorState({
  title = 'Failed to load data',
  message = 'An unexpected network error occurred while contacting the detection service.',
  onRetry,
  className = '',
}) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-risk-200 bg-risk-50/50',
        className
      )}
    >
      <div className="w-12 h-12 rounded-2xl bg-risk-100 text-risk-600 flex items-center justify-center mb-3">
        <AlertCircle className="w-6 h-6 stroke-[2]" />
      </div>
      <h4 className="text-sm font-bold text-risk-900">{title}</h4>
      <p className="text-xs text-risk-700 max-w-sm mt-1 leading-relaxed">{message}</p>
      {onRetry && (
        <div className="mt-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={onRetry}
            icon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Retry Request
          </Button>
        </div>
      )}
    </div>
  )
}
