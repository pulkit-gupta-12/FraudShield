import { mockStore } from '../mock/index.js'
import { delay } from '../utils/delay.js'

/**
 * REST Endpoint: GET /api/v1/transactions/
 * Query params: { page = 1, limit = 20, search, riskTier, userId, merchant, startDate, endDate }
 */
export async function getTransactions(params = {}) {
  await delay(300, 600)
  const {
    page = 1,
    limit = 20,
    search = '',
    riskTier = 'ALL',
    userId = null,
    merchant = null,
    status = 'ALL',
  } = params

  let filtered = [...mockStore.transactions]

  if (userId) {
    filtered = filtered.filter((t) => t.userId === userId)
  }

  if (merchant) {
    filtered = filtered.filter((t) => t.merchant.toLowerCase().includes(merchant.toLowerCase()))
  }

  if (riskTier && riskTier !== 'ALL') {
    filtered = filtered.filter((t) => t.trueLabel === riskTier)
  }

  if (status && status !== 'ALL') {
    filtered = filtered.filter((t) => t.status === status)
  }

  if (search) {
    const q = search.toLowerCase()
    filtered = filtered.filter(
      (t) =>
        t.id.toLowerCase().includes(q) ||
        t.customerName.toLowerCase().includes(q) ||
        t.merchant.toLowerCase().includes(q) ||
        t.cardNumber.includes(q)
    )
  }

  const total = filtered.length
  const startIndex = (page - 1) * limit
  const paginated = filtered.slice(startIndex, startIndex + limit)

  return {
    data: paginated,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
  }
}

/**
 * REST Endpoint: GET /api/v1/transactions/:id/
 */
export async function getTransactionById(id) {
  await delay(300, 500)
  const txn = mockStore.transactions.find((t) => t.id === id)
  if (!txn) throw new Error(`Transaction ${id} not found`)
  return txn
}

/**
 * REST Endpoint: PATCH /api/v1/transactions/:id/status/
 */
export async function updateTransactionStatus(id, newStatus, reason = '') {
  await delay(400, 700)
  const txn = mockStore.transactions.find((t) => t.id === id)
  if (!txn) throw new Error(`Transaction ${id} not found`)

  txn.status = newStatus
  txn.resolvedReason = reason
  txn.updatedAt = new Date().toISOString()

  // Add audit log
  mockStore.auditLogs.unshift({
    id: `LOG-${Date.now()}`,
    timestamp: new Date().toISOString(),
    actor: 'Analyst User',
    actorRole: 'analyst',
    action: `TRANSACTION_${newStatus.toUpperCase()}`,
    target: id,
    ipAddress: '103.44.11.22',
    status: 'SUCCESS',
    details: `Status changed to ${newStatus}. Reason: ${reason || 'Manual review'}`,
  })

  return txn
}

/**
 * REST Endpoint: POST /api/v1/transactions/batch-score/
 */
export async function batchScoreTransactions(rows) {
  await delay(600, 900)
  const scored = rows.map((row, idx) => {
    const amount = Number(row.Amount || row.amount || 1000)
    const isHigh = amount > 25000 || idx % 15 === 0
    const riskScore = isHigh ? Number((0.75 + Math.random() * 0.2).toFixed(3)) : Number((0.02 + Math.random() * 0.3).toFixed(3))
    return {
      ...row,
      id: row.id || `BATCH-${Date.now()}-${idx + 1}`,
      riskScore,
      trueLabel: riskScore >= 0.7 ? 'FRAUD' : riskScore >= 0.4 ? 'SUSPICIOUS' : 'LEGIT',
      status: riskScore >= 0.7 ? 'Blocked' : riskScore >= 0.4 ? 'Under Review' : 'Approved',
    }
  })

  return {
    processedCount: scored.length,
    flaggedCount: scored.filter((s) => s.riskScore >= 0.4).length,
    fraudCount: scored.filter((s) => s.riskScore >= 0.7).length,
    results: scored,
  }
}
