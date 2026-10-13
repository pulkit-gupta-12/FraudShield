import { RISK_LEVELS, RISK_THRESHOLDS } from '../config/constants.js'

/**
 * Categorizes risk based on 0-1 score
 */
export function getRiskTier(score) {
  if (score >= RISK_THRESHOLDS.FRAUD) {
    return {
      label: RISK_LEVELS.FRAUD,
      tier: 'danger',
      colorToken: 'risk',
      tailwindText: 'text-risk-700',
      tailwindBg: 'bg-risk-50',
      tailwindBorder: 'border-risk-200',
      badgeClass: 'bg-risk-100 text-risk-800 border border-risk-300',
    }
  }
  if (score >= RISK_THRESHOLDS.SUSPICIOUS) {
    return {
      label: RISK_LEVELS.SUSPICIOUS,
      tier: 'warning',
      colorToken: 'review',
      tailwindText: 'text-review-700',
      tailwindBg: 'bg-review-50',
      tailwindBorder: 'border-review-200',
      badgeClass: 'bg-review-100 text-review-800 border border-review-300',
    }
  }
  return {
    label: RISK_LEVELS.LEGIT,
    tier: 'success',
    colorToken: 'safe',
    tailwindText: 'text-safe-700',
    tailwindBg: 'bg-safe-50',
    tailwindBorder: 'border-safe-200',
    badgeClass: 'bg-safe-100 text-safe-800 border border-safe-300',
  }
}
