/**
 * stats.js
 *
 * Dashboard statistics service.
 * Mock mode: computes from the in-memory mockStore.
 * Real mode: calls the Django stats endpoints.
 *
 * All functions return the same data shape in both modes.
 */

import { mockStore } from '../mock/index.js'
import { delay } from '../utils/delay.js'
import apiClient from './apiClient.js'
import { THRESHOLD, REVIEW_FLOOR } from '../config/constants.js'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// ─── Overview stats ──────────────────────────────────────────────────────────

/**
 * GET /api/stats/overview/
 * Returns high-level numbers for the admin / analyst dashboard cards.
 */
export async function getOverviewStats() {
  if (!USE_MOCK) {
    const { data } = await apiClient.get('/stats/overview/')
    return data
  }

  await delay(300, 550)
  const txns = mockStore.transactions
  const total = txns.length
  const fraudCount      = txns.filter((t) => t.trueLabel === 'FRAUD').length
  const suspiciousCount = txns.filter((t) => t.trueLabel === 'SUSPICIOUS').length
  const legitCount      = txns.filter((t) => t.trueLabel === 'LEGIT').length
  const fraudRate       = total > 0 ? Number(((fraudCount / total) * 100).toFixed(2)) : 0
  const fraudVolumeINR  = txns
    .filter((t) => t.trueLabel === 'FRAUD')
    .reduce((sum, t) => sum + t.amountINR, 0)
  const totalVolumeINR  = txns.reduce((sum, t) => sum + t.amountINR, 0)

  return {
    totalTransactions: total,
    fraudCount,
    suspiciousCount,
    legitCount,
    fraudRate,
    fraudVolumeINR,
    totalVolumeINR,
    activeAlerts: mockStore.alerts.filter((a) => a.status === 'new').length,
    openCases:    mockStore.cases.filter((c) => c.status === 'Open' || c.status === 'In Review').length,
    activeCards:  mockStore.cards.filter((c) => c.status === 'active').length,
  }
}

// ─── Time-series (daily trend) ────────────────────────────────────────────────

/**
 * GET /api/stats/timeseries/?days=14
 * Daily totals/fraud/suspicious for trend charts.
 */
export async function getTimeseriesStats({ days = 14 } = {}) {
  if (!USE_MOCK) {
    const { data } = await apiClient.get('/stats/timeseries/', { params: { days } })
    return data
  }

  await delay(300, 500)
  const now = Date.now()
  return Array.from({ length: days }, (_, idx) => {
    const date = new Date(now - (days - 1 - idx) * 86400000)
    const label = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    return {
      date: label,
      total:      25 + Math.floor(Math.sin(idx) * 8 + idx * 1.5),
      fraud:      Math.max(0, Math.floor(Math.sin(idx * 0.8) * 3 + 2)),
      suspicious: Math.max(1, Math.floor(Math.cos(idx * 0.5) * 4 + 3)),
    }
  })
}

// ─── By hour ──────────────────────────────────────────────────────────────────

/**
 * GET /api/stats/by-hour/
 * Transaction + fraud counts grouped by hour of day (0-23).
 */
export async function getByHourStats() {
  if (!USE_MOCK) {
    const { data } = await apiClient.get('/stats/by-hour/')
    return data
  }

  await delay(250, 450)
  return Array.from({ length: 24 }, (_, hour) => {
    const total = hour >= 9 && hour <= 20
      ? 40 + Math.floor(Math.random() * 30)
      : 5  + Math.floor(Math.random() * 10)
    return {
      hour,
      label: `${String(hour).padStart(2, '0')}:00`,
      total,
      fraud: Math.floor(total * (hour >= 1 && hour <= 5 ? 0.12 : 0.02)),
    }
  })
}

// ─── By category ─────────────────────────────────────────────────────────────

/**
 * GET /api/stats/by-category/
 * Fraud count/rate grouped by merchant category.
 */
export async function getByCategoryStats() {
  if (!USE_MOCK) {
    const { data } = await apiClient.get('/stats/by-category/')
    return data
  }

  await delay(300, 500)
  const counts = {}
  mockStore.transactions.forEach((t) => {
    const cat = t.merchantCategory || 'Other'
    if (!counts[cat]) counts[cat] = { total: 0, fraud: 0, volumeINR: 0 }
    counts[cat].total += 1
    counts[cat].volumeINR += t.amountINR
    if (t.trueLabel === 'FRAUD') counts[cat].fraud += 1
  })

  return Object.entries(counts)
    .map(([category, d]) => ({
      category,
      total:     d.total,
      fraud:     d.fraud,
      fraudRate: Number(((d.fraud / d.total) * 100).toFixed(1)),
      volumeINR: d.volumeINR,
    }))
    .sort((a, b) => b.fraud - a.fraud)
}

// ─── Risk distribution ────────────────────────────────────────────────────────

/**
 * GET /api/stats/risk-distribution/
 * Counts of Approved / Needs review / Likely fraud transactions.
 */
export async function getRiskDistributionStats() {
  if (!USE_MOCK) {
    const { data } = await apiClient.get('/stats/risk-distribution/')
    return data
  }

  await delay(250, 400)
  const txns = mockStore.transactions
  return [
    { band: 'Approved',     count: txns.filter((t) => (t.riskScore ?? 0) < REVIEW_FLOOR).length,                      color: '#16a34a' },
    { band: 'Needs review', count: txns.filter((t) => (t.riskScore ?? 0) >= REVIEW_FLOOR && (t.riskScore ?? 0) < THRESHOLD).length, color: '#d97706' },
    { band: 'Likely fraud', count: txns.filter((t) => (t.riskScore ?? 0) >= THRESHOLD).length,                      color: '#dc2626' },
  ]
}

// ─── Top risky merchants ──────────────────────────────────────────────────────

/**
 * GET /api/stats/merchant/?limit=6
 * Top merchants by fraud rate.
 */
export async function getMerchantStats({ limit = 6 } = {}) {
  if (!USE_MOCK) {
    const { data } = await apiClient.get('/stats/merchant/', { params: { limit } })
    return data
  }

  await delay(300, 500)
  const counts = {}
  mockStore.transactions.forEach((t) => {
    if (!counts[t.merchant]) counts[t.merchant] = { total: 0, fraud: 0, volumeINR: 0 }
    counts[t.merchant].total    += 1
    counts[t.merchant].volumeINR += t.amountINR
    if (t.trueLabel === 'FRAUD' || t.riskScore >= THRESHOLD) counts[t.merchant].fraud += 1
  })

  return Object.entries(counts)
    .map(([merchant, d]) => ({
      merchant,
      fraudRate:  Number(((d.fraud / d.total) * 100).toFixed(1)),
      fraudCount: d.fraud,
      totalCount: d.total,
      volumeINR:  d.volumeINR,
    }))
    .sort((a, b) => b.fraudRate - a.fraudRate)
    .slice(0, limit)
}

// ─── Analyst performance ──────────────────────────────────────────────────────

/**
 * GET /api/stats/analyst/
 * Per-analyst case resolution stats.
 */
export async function getAnalystStats() {
  if (!USE_MOCK) {
    const { data } = await apiClient.get('/stats/analyst/')
    return data
  }

  await delay(300, 500)
  const analysts = mockStore.users.filter((u) => u.role === 'analyst')
  return analysts.map((a) => {
    const total    = mockStore.cases.filter((c) => c.assignedTo === a.id || c.assignedTo === a.name).length
    const resolved = mockStore.cases.filter(
      (c) => (c.assignedTo === a.id || c.assignedTo === a.name) && c.status === 'Closed',
    ).length
    return {
      analystId:   a.id,
      analystName: a.name,
      totalCases:  total || Math.floor(3 + Math.random() * 15),
      resolved:    resolved || Math.floor(1 + Math.random() * 8),
      avgResolutionHrs: Number((4 + Math.random() * 20).toFixed(1)),
    }
  })
}

// ─── Public Summary (Landing Page) ──────────────────────────────────────────

/**
 * GET /api/public/summary/
 * Unauthenticated system totals and model metrics for public landing page.
 */
export async function getPublicSummary() {
  if (!USE_MOCK) {
    const { data } = await apiClient.get('/public/summary/')
    return data
  }
  return {
    transactionsScanned: 6000,
    fraudsBlocked: 127,
    moneyProtected: 492040.5,
    avgDetectionTimeMs: 18.2,
    precision: 1.0,
    recall: 0.7938,
    prAuc: 0.8144,
  }
}
