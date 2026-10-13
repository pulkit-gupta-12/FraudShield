import React from 'react'
import clsx from 'clsx'
import { Check } from 'lucide-react'

/**
 * Stepper workflow progression component.
 * 
 * @param {Array<{label: string, description?: string}>} steps
 * @param {number} currentStep - 0-indexed current active step
 */
export function Stepper({ steps = [], currentStep = 0, className = '' }) {
  return (
    <div className={clsx('w-full', className)}>
      <ol className="flex items-center w-full">
        {steps.map((step, idx) => {
          const isCompleted = idx < currentStep
          const isCurrent = idx === currentStep

          return (
            <li
              key={idx}
              className={clsx(
                'flex items-center',
                idx < steps.length - 1 ? 'w-full' : ''
              )}
            >
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <div
                  className={clsx(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all shadow-xs',
                    isCompleted
                      ? 'bg-safe-500 text-white'
                      : isCurrent
                      ? 'bg-primary text-white ring-4 ring-primary-100'
                      : 'bg-neutral-100 text-neutral-400 border border-neutral-200'
                  )}
                >
                  {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : idx + 1}
                </div>
                <div className="text-center sm:text-left">
                  <p
                    className={clsx(
                      'text-xs font-bold leading-tight',
                      isCurrent ? 'text-primary-600' : isCompleted ? 'text-neutral-800' : 'text-neutral-400'
                    )}
                  >
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-[10px] text-neutral-400 hidden sm:block">{step.description}</p>
                  )}
                </div>
              </div>

              {idx < steps.length - 1 && (
                <div
                  className={clsx(
                    'flex-1 h-0.5 mx-3 sm:mx-6 rounded-full transition-all',
                    isCompleted ? 'bg-safe-500' : 'bg-neutral-200'
                  )}
                />
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
