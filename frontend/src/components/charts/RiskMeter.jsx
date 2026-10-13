import React from 'react'
import clsx from 'clsx'
import { getRiskTier } from '../../utils/risk.js'

/**
 * Semicircle gauge (0-100) with dynamic needle and threshold markers.
 * 
 * @param {number} value - Score from 0 to 100 (or 0.0 to 1.0)
 * @param {number} [threshold=70] - Fraud cutoff threshold
 * @param {number} [warningThreshold=40] - Suspicious cutoff threshold
 * @param {number} [size=220] - Gauge width in px
 */
export function RiskMeter({
  value = 0,
  threshold = 70,
  warningThreshold = 40,
  size = 220,
  showLabels = true,
  className = '',
}) {
  // Normalize value to 0-100
  const score = value <= 1 ? Math.round(value * 100) : Math.round(value)
  const clamped = Math.min(100, Math.max(0, score))
  const riskInfo = getRiskTier(clamped / 100)

  // Semicircle geometry
  const radius = 80
  const cx = 110
  const cy = 100
  const strokeWidth = 14

  // Needle angle (-90 deg at 0, 90 deg at 100)
  const angle = -90 + (clamped / 100) * 180
  const rad = (angle * Math.PI) / 180
  const needleLength = radius - 15
  const needleX = cx + needleLength * Math.cos(rad)
  const needleY = cy + needleLength * Math.sin(rad)

  // Threshold marker coordinates
  const threshAngle = -90 + (threshold / 100) * 180
  const threshRad = (threshAngle * Math.PI) / 180
  const tX1 = cx + (radius - 12) * Math.cos(threshRad)
  const tY1 = cy + (radius - 12) * Math.sin(threshRad)
  const tX2 = cx + (radius + 12) * Math.cos(threshRad)
  const tY2 = cy + (radius + 12) * Math.sin(threshRad)

  return (
    <div className={clsx('flex flex-col items-center select-none', className)}>
      <svg
        viewBox="0 0 220 135"
        width={size}
        height={(size * 135) / 220}
        className="overflow-visible"
      >
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="40%" stopColor="#f59e0b" />
            <stop offset="70%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#991b1b" />
          </linearGradient>
        </defs>

        {/* Background Arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Gradient Colored Arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray="251.3"
          strokeDashoffset={251.3 - (clamped / 100) * 251.3}
          className="transition-all duration-700 ease-out"
        />

        {/* Threshold Cutoff Marker (Red tick line) */}
        <line
          x1={tX1}
          y1={tY1}
          x2={tX2}
          y2={tY2}
          stroke="#ef4444"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={needleX}
          y2={needleY}
          stroke="#1e293b"
          strokeWidth="3.5"
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
        <circle cx={cx} cy={cy} r="6" fill="#1e293b" />
        <circle cx={cx} cy={cy} r="2.5" fill="#ffffff" />
      </svg>

      {/* Numerical and Status Label */}
      {showLabels && (
        <div className="text-center -mt-3">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-3xl font-extrabold text-neutral-900 tracking-tight">{clamped}</span>
            <span className="text-sm font-semibold text-neutral-400">/ 100</span>
          </div>
          <p className={clsx('text-xs font-bold uppercase tracking-wider mt-0.5', riskInfo.tailwindText)}>
            {riskInfo.label}
          </p>
          <div className="flex items-center justify-between gap-6 text-[10px] text-neutral-400 mt-2 font-mono">
            <span>0 SAFE</span>
            <span className="text-risk-600 font-semibold">▲ THRESHOLD ({threshold})</span>
            <span>100 FRAUD</span>
          </div>
        </div>
      )}
    </div>
  )
}
