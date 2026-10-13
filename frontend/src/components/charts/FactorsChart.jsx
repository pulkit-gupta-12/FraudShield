import React from 'react'
import clsx from 'clsx'

/**
 * FactorsChart: Horizontal bar visualization of XAI feature importances.
 * Red indicates risk-increasing positive impact, Green indicates risk-decreasing protective factors.
 * 
 * @param {Array<{feature: string, impact: number, description?: string, direction?: string}>} factors
 * @param {number} [maxItems=5]
 */
export function FactorsChart({ factors = [], maxItems = 5, className = '' }) {
  const displayFactors = factors.slice(0, maxItems)

  // Find max absolute value for scaling
  const maxAbs = Math.max(...displayFactors.map((f) => Math.abs(f.impact || 0)), 0.1)

  return (
    <div className={clsx('space-y-3.5', className)}>
      <div className="flex items-center justify-between text-xs text-neutral-400 font-medium pb-1 border-b border-neutral-100">
        <span>Factor & Explanation</span>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="flex items-center gap-1.5 text-safe-700">
            <span className="w-2.5 h-2.5 rounded-xs bg-safe-500" /> Protective (-)
          </span>
          <span className="flex items-center gap-1.5 text-risk-700">
            <span className="w-2.5 h-2.5 rounded-xs bg-risk-500" /> High Risk (+)
          </span>
        </div>
      </div>

      {displayFactors.map((f, idx) => {
        const isPositive = f.impact > 0 || f.direction === 'risk_increasing'
        const absVal = Math.abs(f.impact || 0)
        const percent = Math.min(100, Math.round((absVal / maxAbs) * 100))

        return (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-neutral-800 font-mono">{f.feature}</span>
              <span
                className={clsx(
                  'font-mono font-bold text-xs',
                  isPositive ? 'text-risk-600' : 'text-safe-600'
                )}
              >
                {isPositive ? `+${absVal.toFixed(3)}` : `-${absVal.toFixed(3)}`}
              </span>
            </div>

            {/* Horizontal Bar */}
            <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden flex">
              {isPositive ? (
                <div
                  className="h-full bg-risk-500 rounded-full transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              ) : (
                <div
                  className="h-full bg-safe-500 rounded-full transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              )}
            </div>

            {f.description && (
              <p className="text-[11px] text-neutral-500 truncate">{f.description}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
