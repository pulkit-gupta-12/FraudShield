/**
 * transactions.js
 *
 * List    : GET /api/transactions/
 *           Params: { page, pageSize, search, ordering, riskTier, userId, merchant, status, since }
 *           Returns: { results: Transaction[], count: number }
 *
 * Detail  : GET /api/transactions/{id}/
 * Update  : PATCH /api/transactions/{id}/status/  body: { status, reason }
 * Batch   : POST /api/predict/batch/  multipart CSV
 * Live    : GET /api/transactions/?since=<ISO timestamp>  (poll every 3 s)
 */

import { mockStore } from '../mock/index.js'
import { delay }     from '../utils/delay.js'
import apiClient     from './apiClient.js'
import { THRESHOLD, REVIEW_FLOOR } from '../config/constants.js'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Apply mock-side filtering, sorting, and pagination and return { results, count }. */
function applyMockList(list, { page = 1, pageSize = 20, search = '', ordering = '', ...filters } = {}) {
  let filtered = [...list]

  // Filters
  const { riskTier, userId, merchant, status, customerId } = filters

  if (userId)     filtered = filtered.filter((t) => t.userId === userId)
  if (customerId) filtered = filtered.filter((t) => t.userId === customerId)
  if (merchant)   filtered = filtered.filter((t) => t.merchant?.toLowerCase().includes(merchant.toLowerCase()))

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
        t.id?.toLowerCase().includes(q)           ||
        t.customerName?.toLowerCase().includes(q) ||
        t.merchant?.toLowerCase().includes(q)     ||
        t.cardNumber?.includes(q),
    )
  }

  // Ordering: e.g. '-timestamp' or 'amountINR'
  if (ordering) {
    const desc = ordering.startsWith('-')
    const key  = desc ? ordering.slice(1) : ordering
    filtered.sort((a, b) => {
      const av = a[key], bv = b[key]
      if (av === bv) return 0
      return (av > bv ? 1 : -1) * (desc ? -1 : 1)
    })
  }

  const count      = filtered.length
  const startIndex = (Number(page) - 1) * Number(pageSize)
  const results    = filtered.slice(startIndex, startIndex + Number(pageSize))

  return { results, count }
}

// ─── GET /api/transactions/ ───────────────────────────────────────────────────

export async function getTransactions(params = {}) {
  if (!USE_MOCK) {
    const { data } = await apiClient.get('/transactions/', { params })
    return data // backend returns { results, count }
  }

  await delay(300, 600)
  return applyMockList(mockStore.transactions, params)
}

// ─── GET /api/transactions/{id}/ ─────────────────────────────────────────────

export async function getTransactionById(id) {
  if (!USE_MOCK) {
    const { data } = await apiClient.get(`/transactions/${id}/`)
    return data
  }

  await delay(300, 500)
  const txn = mockStore.transactions.find((t) => t.id === id)
  if (!txn) {
    const err = new Error(`Transaction ${id} not found`)
    err.status = 404
    throw err
  }
  return txn
}

// ─── PATCH /api/transactions/{id}/status/ ────────────────────────────────────

export async function updateTransactionStatus(id, newStatus, reason = '') {
  if (!USE_MOCK) {
    const { data } = await apiClient.patch(`/transactions/${id}/status/`, { status: newStatus, reason })
    return data
  }

  await delay(400, 700)
  const txn = mockStore.transactions.find((t) => t.id === id)
  if (!txn) {
    const err = new Error(`Transaction ${id} not found`)
    err.status = 404
    throw err
  }

  txn.status        = newStatus
  txn.resolvedReason = reason
  txn.updatedAt     = new Date().toISOString()

  mockStore.auditLogs.unshift({
    id:        `LOG-${Date.now()}`,
    timestamp: new Date().toISOString(),
    actor:     'Analyst User',
    actorRole: 'analyst',
    action:    `TRANSACTION_${newStatus.toUpperCase()}`,
    target:    id,
    ipAddress: '103.44.11.22',
    status:    'SUCCESS',
    details:   `Status changed to ${newStatus}. Reason: ${reason || 'Manual review'}`,
  })

  return txn
}

// ─── POST /api/predict/batch/ ─────────────────────────────────────────────────

export async function batchScoreTransactions(rows) {
  if (!USE_MOCK) {
    const formData = new FormData()
    // rows is expected to be a File (CSV) or an array of row objects
    if (rows instanceof File) {
      formData.append('file', rows)
    } else {
      const csvHeader = 'Amount,Time\n'
      const csvBody   = rows.map((r) => `${r.Amount || r.amount || ''},${r.Time || ''}`).join('\n')
      const blob      = new Blob([csvHeader + csvBody], { type: 'text/csv' })
      formData.append('file', blob, 'batch.csv')
    }
    const { data } = await apiClient.post('/predict/batch/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    // data = { processedCount, flaggedCount, fraudCount, results: [...] }
    return data
  }

  await delay(600, 900)
  const scored = rows.map((row, idx) => {
    const amount   = Number(row.Amount || row.amount || 1000)
    const isHigh   = amount > 25000 || idx % 15 === 0
    const riskScore = isHigh
      ? Number((THRESHOLD + Math.random() * 0.08).toFixed(3))
      : Number((0.02 + Math.random() * 0.45).toFixed(3))
    return {
      ...row,
      id:        row.id || `BATCH-${Date.now()}-${idx + 1}`,
      riskScore,
      band:      riskScore >= THRESHOLD ? 'FRAUD' : riskScore >= REVIEW_FLOOR ? 'SUSPICIOUS' : 'LEGIT',
      trueLabel: riskScore >= THRESHOLD ? 'FRAUD' : riskScore >= REVIEW_FLOOR ? 'SUSPICIOUS' : 'LEGIT',
      status:    riskScore >= THRESHOLD ? 'Blocked' : riskScore >= REVIEW_FLOOR ? 'Under Review' : 'Approved',
      factors:   [{ name: 'Amount', impact: riskScore >= REVIEW_FLOOR ? 0.4 : -0.2 }],
    }
  })

  return {
    processedCount: scored.length,
    flaggedCount:   scored.filter((s) => s.riskScore >= REVIEW_FLOOR).length,
    fraudCount:     scored.filter((s) => s.riskScore >= THRESHOLD).length,
    results:        scored,
  }
}

// ─── Live feed  (GET /api/transactions/?since=<ISO>) ─────────────────────────
// Poll this every 3 s in components; returns { results, count } same as getTransactions.

let _liveLastTimestamp = null

export async function getLiveTransactions(since) {
  if (!USE_MOCK) {
    const timestamp = (since !== undefined && since !== null) ? since : (_liveLastTimestamp || '')
    const params = {
      since: timestamp,
      ordering: '-timestamp',
      pageSize: 10,
    }
    const { data } = await apiClient.get('/transactions/', { params })
    if (data.results?.length) {
      _liveLastTimestamp = data.results[0].timestamp
    }
    return data
  }

  // Mock: simulate new transaction(s) arriving occasionally
  await delay(100, 300)
  const now    = new Date().toISOString()
  const thresholdTime = since !== undefined ? since : _liveLastTimestamp
  const recent = mockStore.transactions.filter(
    (t) => !thresholdTime || t.timestamp > thresholdTime,
  ).slice(0, 5)

  _liveLastTimestamp = now

  // Occasionally inject a new synthetic transaction so the feed animates
  if (Math.random() < 0.4) {
    const base = mockStore.transactions[Math.floor(Math.random() * 30)]
    if (base) {
      const fresh = {
        ...base,
        id:        `TXN-LIVE-${Date.now()}`,
        timestamp: now,
        riskScore: Number((Math.random()).toFixed(3)),
      }
      fresh.trueLabel = fresh.riskScore >= THRESHOLD ? 'FRAUD' : fresh.riskScore >= REVIEW_FLOOR ? 'SUSPICIOUS' : 'LEGIT'
      mockStore.transactions.unshift(fresh)
      return { results: [fresh, ...recent].slice(0, 10), count: mockStore.transactions.length }
    }
  }

  return { results: mockStore.transactions.slice(0, 10), count: mockStore.transactions.length }
}

/** Reset the live-feed timestamp (call when the live-feed component unmounts or reinits). */
export function resetLiveFeed() {
  _liveLastTimestamp = null
}

// ─── POST /api/transactions/submit/ ───────────────────────────────────────────

export async function submitTransaction(payload) {
  if (!USE_MOCK) {
    const { data } = await apiClient.post('/transactions/submit/', payload)
    return data
  }

  await delay(400, 700)
  const amount = Number(payload.amount || 1000)
  const isDeclined = amount > 200000
  const riskScore = isDeclined ? null : Number((0.05 + Math.random() * 0.9).toFixed(3))
  const decision = isDeclined
    ? 'declined'
    : riskScore >= THRESHOLD
    ? 'blocked'
    : riskScore >= REVIEW_FLOOR
    ? 'review'
    : 'approved'

  const mockTxn = {
    id: `TXN-${Date.now()}`,
    amountINR: amount,
    city: payload.city || 'Mumbai',
    merchant: payload.merchantName || 'Mock Merchant',
    status: decision === 'review' ? 'flagged' : decision,
    riskScore,
    band: decision,
    timestamp: payload.occurredAt || new Date().toISOString(),
  }

  return {
    transaction: mockTxn,
    decision,
    reason: decision === 'declined' ? 'limit_exceeded' : decision,
    reasons: isDeclined
      ? ['Transaction declined: amount exceeds card spending limit.']
      : riskScore >= REVIEW_FLOOR
      ? ['High-risk merchant category detected', 'Unusual transaction timing']
      : ['Typical purchase behavior verified'],
    riskScore,
    band: decision,
    threshold: THRESHOLD,
    reviewFloor: REVIEW_FLOOR,
    factors: [
      { feature: 'Amount', impact: 0.35, description: 'Transaction size' },
      { feature: 'V14', impact: 0.28, description: 'Behavior factor 14' },
      { feature: 'V4', impact: -0.15, description: 'Protective velocity indicator' },
    ],
    alertId: decision === 'review' ? 101 : null,
    caseId: decision === 'review' ? 201 : null,
  }
}

// ─── POST /api/transactions/{id}/report/ ─────────────────────────────────────

export async function reportTransaction(id, { reason, note }) {
  if (!USE_MOCK) {
    const { data } = await apiClient.post(`/transactions/${id}/report/`, { reason, note })
    return data
  }

  await delay(300, 600)
  return {
    success: true,
    message: 'Report filed successfully. Our fraud operations team has been notified.',
    reportId: Date.now(),
    caseId: 301,
    disputeId: 401,
  }
}

// ─── GET /api/reports/mine/ ──────────────────────────────────────────────────

export async function getMyReports() {
  if (!USE_MOCK) {
    const { data } = await apiClient.get('/reports/mine/')
    return Array.isArray(data) ? { results: data, count: data.length } : data
  }

  await delay(300, 500)
  return {
    results: [
      {
        id: 1,
        transaction: {
          publicId: 'TXN-984210',
          amountInr: 12450,
          merchantName: 'Unrecognized Tech Mart',
          timestamp: new Date(Date.now() - 86400000).toISOString(),
        },
        reason: 'unauthorized',
        note: 'I never made this purchase in Chennai.',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        case: { id: 101, status: 'in_investigation', priority: 'high' },
        dispute: { id: 201, stage: 'evidence_collection', status: 'open' },
      },
    ],
    count: 1,
  }
}

