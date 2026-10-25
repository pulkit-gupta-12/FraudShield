import React, { useId } from 'react'
import clsx from 'clsx'
import { getRiskTier } from '../../utils/risk.js'
import { THRESHOLD, REVIEW_FLOOR } from '../../config/constants.js'

/**
 * Semicircle gauge (0-100) with dynamic needle and threshold markers.
 * 
 * @param {number} [value=0] - Score from 0 to 100 (or 0.0 to 1.0)
 * @param {number} [score] - Alias for value
 * @param {number} [threshold=89] - Fraud cutoff threshold (main marker)
 * @param {number} [warningThreshold=50] - Review floor cutoff threshold (lighter marker)
 * @param {number} [size=220] - Gauge width in px
 */
export function RiskMeter({
  value = 0,
  score: scoreProp,
  threshold = Math.round(THRESHOLD * 100),
  warningThreshold = Math.round(REVIEW_FLOOR * 100),
  size = 220,
  showLabels = true,
  className = '',
}) {
  const gradientId = useId().replace(/:/g, '')
  const rawValue = scoreProp !== undefined ? scoreProp : value
  const score = rawValue <= 1 ? Math.round(rawValue * 100) : Math.round(rawValue)
  const clamped = Math.min(100, Math.max(0, score))
  const riskInfo = getRiskTier(clamped / 100)

  // Semicircle geometry
  // Arc sweeps from left (cx - radius, cy) through top (cx, cy - radius) to right (cx + radius, cy)
  const radius = 80
  const cx = 110
  const cy = 105
  const strokeWidth = 14

  // Needle angle: t in [0, 1] sweeps from left (t=0, rad=0) to right (t=1, rad=PI)
  const t = clamped / 100
  const needleLength = radius - 14
  const needleX = cx - needleLength * Math.cos(t * Math.PI)
  const needleY = cy - needleLength * Math.sin(t * Math.PI)

  // Main threshold cutoff marker (red)
  const threshT = Math.min(1, Math.max(0, threshold / 100))
  const tX1 = cx - (radius - 12) * Math.cos(threshT * Math.PI)
  const tY1 = cy - (radius - 12) * Math.sin(threshT * Math.PI)
  const tX2 = cx - (radius + 12) * Math.cos(threshT * Math.PI)
  const tY2 = cy - (radius + 12) * Math.sin(threshT * Math.PI)

  // Review floor marker (amber)
  const warnT = Math.min(1, Math.max(0, warningThreshold / 100))
  const wX1 = cx - (radius - 10) * Math.cos(warnT * Math.PI)
  const wY1 = cy - (radius - 10) * Math.sin(warnT * Math.PI)
  const wX2 = cx - (radius + 10) * Math.cos(warnT * Math.PI)
  const wY2 = cy - (radius + 10) * Math.sin(warnT * Math.PI)

  // Accent color for needle & badge
  const accentColor =
    clamped >= threshold
      ? '#ef4444'
      : clamped >= warningThreshold
      ? '#f59e0b'
      : '#10b981'

  return (
    <div className={clsx('flex flex-col items-center select-none', className)}>
      <svg
        viewBox="0 0 220 120"
        width={size}
        height={(size * 120) / 220}
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={`grad-${gradientId}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="45%" stopColor="#10b981" />
            <stop offset="55%" stopColor="#f59e0b" />
            <stop offset="85%" stopColor="#f59e0b" />
            <stop offset="90%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>
          <filter id={`shadow-${gradientId}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* Background Track Arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Active Gradient Filled Arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke={`url(#grad-${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray="251.3"
          strokeDashoffset={251.3 - (clamped / 100) * 251.3}
          className="transition-all duration-700 ease-out"
        />

        {/* Review Floor Marker (amber tick) */}
        <line
          x1={wX1}
          y1={wY1}
          x2={wX2}
          y2={wY2}
          stroke="#f59e0b"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Cutoff Threshold Marker (red tick) */}
        <line
          x1={tX1}
          y1={tY1}
          x2={tX2}
          y2={tY2}
          stroke="#ef4444"
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* Sleek Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={needleX}
          y2={needleY}
          stroke="#1e293b"
          strokeWidth="3.5"
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
          filter={`url(#shadow-${gradientId})`}
        />

        {/* Center Pivot Indicator */}
        <circle cx={cx} cy={cy} r="8" fill="#1e293b" />
        <circle cx={cx} cy={cy} r="4" fill={accentColor} className="transition-colors duration-500" />
      </svg>

      {/* Numerical and Status Label */}
      {showLabels && (
        <div className="text-center mt-2">
          <div className="flex items-baseline justify-center gap-1.5">
            <span className="text-3xl font-extrabold text-neutral-900 tracking-tight">{clamped}</span>
            <span className="text-sm font-semibold text-neutral-400">/ 100</span>
          </div>
          <div className="mt-1">
            <span
              className={clsx(
                'inline-block px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider',
                clamped >= threshold
                  ? 'bg-rose-100 text-rose-700'
                  : clamped >= warningThreshold
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'
              )}
            >
              {riskInfo.label}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default RiskMeter
