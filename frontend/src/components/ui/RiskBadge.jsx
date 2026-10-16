import React from 'react'
import clsx from 'clsx'
import { ShieldCheck, AlertTriangle, ShieldAlert } from 'lucide-react'
import { THRESHOLD, REVIEW_FLOOR } from '../../config/constants.js'

/**
 * RiskBadge component for displaying transaction classification.
 * 
 * @param {'LEGIT'|'SUSPICIOUS'|'FRAUD'|'safe'|'review'|'risk'|number} [level] - Label or numeric riskScore (0-1)
 * @param {'sm'|'md'} [size='sm']
 * @param {boolean} [showScore=false]
 * @param {number} [score]
 */
export function RiskBadge({
  level,
  size = 'sm',
  showScore = false,
  score = null,
  className = '',
}) {
  const [thresholds, setThresholds] = React.useState(() => ({
    reviewFloor: REVIEW_FLOOR,
    threshold: THRESHOLD,
  }))

  React.useEffect(() => {
    const handler = (e) => {
      if (e.detail) {
        setThresholds({
          reviewFloor: Number(e.detail.reviewFloor ?? e.detail.suspicious) || REVIEW_FLOOR,
          threshold: Number(e.detail.threshold ?? e.detail.fraud) || THRESHOLD,
        })
      }
    }
    window.addEventListener('threshold-updated', handler)
    return () => window.removeEventListener('threshold-updated', handler)
  }, [])

  let tier = 'safe'
  let label = 'Safe'
  let displayScore = score

  const targetScore = typeof level === 'number' ? level : (typeof score === 'number' ? score : null)

  if (targetScore !== null) {
    displayScore = targetScore
    if (targetScore >= thresholds.threshold) {
      tier = 'risk'
      label = 'High Risk'
    } else if (targetScore >= thresholds.reviewFloor) {
      tier = 'review'
      label = 'Review'
    } else {
      tier = 'safe'
      label = 'Safe'
    }
  } else if (level) {
    const norm = String(level).toUpperCase()
    if (['FRAUD', 'RISK', 'HIGH RISK', 'HIGH', 'LIKELY FRAUD', 'BLOCKED'].includes(norm)) {
      tier = 'risk'
      label = 'High Risk'
    } else if (['SUSPICIOUS', 'REVIEW', 'NEEDS REVIEW', 'UNDER REVIEW'].includes(norm)) {
      tier = 'review'
      label = 'Review'
    } else {
      tier = 'safe'
      label = 'Safe'
    }
  }

  const styles = {
    safe: {
      bg: 'bg-safe-50 text-safe-700 border-safe-200',
      icon: <ShieldCheck className="w-3.5 h-3.5 text-safe-600 shrink-0" />,
    },
    review: {
      bg: 'bg-review-50 text-review-700 border-review-200',
      icon: <AlertTriangle className="w-3.5 h-3.5 text-review-600 shrink-0" />,
    },
    risk: {
      bg: 'bg-risk-50 text-risk-700 border-risk-200',
      icon: <ShieldAlert className="w-3.5 h-3.5 text-risk-600 shrink-0" />,
    },
  }

  const current = styles[tier]

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 font-bold uppercase tracking-wider rounded-full border shadow-xs select-none',
        current.bg,
        size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3.5 py-1 text-xs',
        className
      )}
    >
      {current.icon}
      <span>{label}</span>
      {showScore && displayScore != null && (
        <span className="font-mono opacity-80 pl-1 border-l border-current/20">
          {Math.round(displayScore * 100)}%
        </span>
      )}
    </span>
  )
}
