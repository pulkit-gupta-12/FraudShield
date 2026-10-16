/**
 * Formats a number as Indian Rupee (INR) currency
 */
export function formatCurrencyINR(amount) {
  if (amount == null || isNaN(amount)) return '₹0'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export const formatCurrency = formatCurrencyINR

/**
 * Formats ISO date to readable string
 */
export function formatDate(isoString, includeTime = true) {
  if (!isoString) return '-'
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return '-'

  const options = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }
  return new Intl.DateTimeFormat('en-IN', options).format(date)
}

export const formatDateTime = (isoString) => formatDate(isoString, true)

/**
 * Formats relative time (e.g. 5m ago, 2h ago)
 */
export function formatRelativeTime(isoString) {
  if (!isoString) return '-'
  const date = new Date(isoString)
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000)

  if (diffSec < 60) return 'Just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  return `${Math.floor(diffSec / 86400)}d ago`
}

/**
 * Formats percentage
 */
export function formatPercent(value, decimals = 1) {
  if (value == null || isNaN(value)) return '0.0%'
  return `${(value * (value <= 1 ? 100 : 1)).toFixed(decimals)}%`
}

/**
 * Masks credit card number
 */
export function maskCardNumber(cardNumber) {
  if (!cardNumber) return '•••• •••• •••• ••••'
  const cleaned = cardNumber.replace(/\s+/g, '')
  const last4 = cleaned.slice(-4)
  return `•••• •••• •••• ${last4}`
}
