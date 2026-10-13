import { mockStore } from '../mock/index.js'
import { delay } from '../utils/delay.js'

/**
 * REST Endpoint: GET /api/v1/reports/summary/
 */
export async function getGlobalStats() {
  await delay(300, 550)
  const txns = mockStore.transactions
  const total = txns.length
  const fraudCount = txns.filter((t) => t.trueLabel === 'FRAUD').length
  const suspiciousCount = txns.filter((t) => t.trueLabel === 'SUSPICIOUS').length
  const legitCount = txns.filter((t) => t.trueLabel === 'LEGIT').length
  const fraudRate = total > 0 ? (fraudCount / total) * 100 : 0
  const fraudVolumeINR = txns
    .filter((t) => t.trueLabel === 'FRAUD')
    .reduce((sum, t) => sum + t.amountINR, 0)
  const totalVolumeINR = txns.reduce((sum, t) => sum + t.amountINR, 0)

  return {
    totalTransactions: total,
    fraudCount,
    suspiciousCount,
    legitCount,
    fraudRate: Number(fraudRate.toFixed(2)),
    fraudVolumeINR,
    totalVolumeINR,
    activeAlerts: mockStore.alerts.filter((a) => a.status === 'new').length,
    openCases: mockStore.cases.filter((c) => c.status === 'Open' || c.status === 'In Review').length,
    activeCards: mockStore.cards.filter((c) => c.status === 'active').length,
  }
}

/**
 * REST Endpoint: GET /api/v1/reports/trends/
 */
export async function getDailyTrends() {
  await delay(300, 500)
  // Aggregate mock trends over 14 days
  const days = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7', 'Day 8', 'Day 9', 'Day 10', 'Day 11', 'Day 12', 'Day 13', 'Day 14']
  return days.map((day, idx) => ({
    date: day,
    total: 25 + Math.floor(Math.sin(idx) * 8 + idx * 1.5),
    fraud: Math.max(0, Math.floor(Math.sin(idx * 0.8) * 3 + 2)),
    suspicious: Math.max(1, Math.floor(Math.cos(idx * 0.5) * 4 + 3)),
  }))
}

/**
 * REST Endpoint: GET /api/v1/reports/merchants/
 */
export async function getTopRiskyMerchants() {
  await delay(300, 500)
  const counts = {}
  mockStore.transactions.forEach((t) => {
    if (!counts[t.merchant]) counts[t.merchant] = { total: 0, fraud: 0, volumeINR: 0 }
    counts[t.merchant].total += 1
    counts[t.merchant].volumeINR += t.amountINR
    if (t.trueLabel === 'FRAUD' || t.riskScore >= 0.7) {
      counts[t.merchant].fraud += 1
    }
  })

  return Object.entries(counts)
    .map(([merchant, data]) => ({
      merchant,
      fraudRate: Number(((data.fraud / data.total) * 100).toFixed(1)),
      fraudCount: data.fraud,
      totalCount: data.total,
      volumeINR: data.volumeINR,
    }))
    .sort((a, b) => b.fraudRate - a.fraudRate)
    .slice(0, 6)
}

/**
 * REST Endpoint: GET /api/v1/reports/audit-logs/
 */
export async function getAuditLogs(limit = 40) {
  await delay(300, 500)
  return mockStore.auditLogs.slice(0, limit)
}
