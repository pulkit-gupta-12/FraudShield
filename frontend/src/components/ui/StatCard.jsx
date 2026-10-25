import React from 'react'
import clsx from 'clsx'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

/**
 * Metric StatCard with icon, value, and trend arrow.
 * 
 * @param {string} title
 * @param {string|number} value
 * @param {React.ReactNode} icon
 * @param {number|string} [trend] - e.g. "+12.4%" or -5.2
 * @param {'up'|'down'|'neutral'} [trendDirection]
 * @param {string} [subtitle]
 * @param {'primary'|'safe'|'review'|'risk'|'neutral'} [color='primary']
 */
export function StatCard({
  title,
  label,
  value,
  icon,
  trend,
  trendDirection,
  subtitle,
  subtext,
  color = 'primary',
  className = '',
  loading = false,
}) {
  const heading = title || label || ''
  const description = subtitle || subtext || ''

  const isPositiveTrend = trendDirection ? trendDirection === 'up' : typeof trend === 'number' ? trend > 0 : String(trend).startsWith('+')
  const isNeutralTrend = trendDirection === 'neutral' || trend == null

  const colorStyles = {
    primary: 'bg-primary-50 text-primary-600',
    safe: 'bg-safe-50 text-safe-600',
    review: 'bg-review-50 text-review-600',
    warning: 'bg-amber-50 text-amber-600',
    risk: 'bg-risk-50 text-risk-600',
    danger: 'bg-red-50 text-red-600',
    neutral: 'bg-neutral-100 text-neutral-600',
  }

  return (
    <div
      className={clsx(
        'bg-white rounded-2xl border border-neutral-200 p-5 shadow-xs hover:border-neutral-300 transition-all',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">{heading}</p>
        {icon && (
          <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', colorStyles[color])}>
            {React.isValidElement(icon)
              ? icon
              : typeof icon === 'function' || (typeof icon === 'object' && icon != null)
              ? React.createElement(icon, { className: 'w-5 h-5' })
              : icon}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900">{value}</span>
      </div>

      {(trend != null || description) && (
        <div className="mt-2.5 flex items-center gap-2 text-xs">
          {trend != null && (
            <span
              className={clsx(
                'inline-flex items-center gap-0.5 font-bold px-1.5 py-0.5 rounded-md',
                isNeutralTrend
                  ? 'bg-neutral-100 text-neutral-600'
                  : isPositiveTrend
                  ? 'bg-safe-50 text-safe-700'
                  : 'bg-risk-50 text-risk-700'
              )}
            >
              {!isNeutralTrend && isPositiveTrend && <TrendingUp className="w-3 h-3" />}
              {!isNeutralTrend && !isPositiveTrend && <TrendingDown className="w-3 h-3" />}
              {isNeutralTrend && <Minus className="w-3 h-3" />}
              {trend}
            </span>
          )}
          {description && <span className="text-neutral-500 truncate">{description}</span>}
        </div>
      )}
    </div>
  )
}
