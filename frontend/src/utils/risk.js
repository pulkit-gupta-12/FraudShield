import { THRESHOLD, REVIEW_FLOOR } from '../config/constants.js'

/**
 * Categorizes risk based on 0-1 score
 * Score below 0.5 -> Safe (green, 'Approved')
 * Score from 0.5 up to 0.89 -> Review (amber, 'Needs review')
 * Score 0.89 or higher -> High Risk (red, 'Likely fraud', blocked)
 */
export function getRiskTier(score) {
  const numScore = Number(score) || 0
  if (numScore >= THRESHOLD) {
    return {
      label: 'Likely fraud',
      badgeLabel: 'High Risk',
      status: 'Blocked',
      band: 'high',
      tier: 'danger',
      colorToken: 'risk',
      tailwindText: 'text-risk-700',
      tailwindBg: 'bg-risk-50',
      tailwindBorder: 'border-risk-200',
      badgeClass: 'bg-risk-100 text-risk-800 border border-risk-300',
    }
  }
  if (numScore >= REVIEW_FLOOR) {
    return {
      label: 'Needs review',
      badgeLabel: 'Review',
      status: 'Needs review',
      band: 'review',
      tier: 'warning',
      colorToken: 'review',
      tailwindText: 'text-review-700',
      tailwindBg: 'bg-review-50',
      tailwindBorder: 'border-review-200',
      badgeClass: 'bg-review-100 text-review-800 border border-review-300',
    }
  }
  return {
    label: 'Approved',
    badgeLabel: 'Safe',
    status: 'Approved',
    band: 'safe',
    tier: 'success',
    colorToken: 'safe',
    tailwindText: 'text-safe-700',
    tailwindBg: 'bg-safe-50',
    tailwindBorder: 'border-safe-200',
    badgeClass: 'bg-safe-100 text-safe-800 border border-safe-300',
  }
}

export function getRiskBand(score) {
  const numScore = Number(score) || 0
  if (numScore >= THRESHOLD) return 'high'
  if (numScore >= REVIEW_FLOOR) return 'review'
  return 'safe'
}

