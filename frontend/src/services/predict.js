/**
 * predict.js
 *
 * Single : POST /api/predict/
 *          Body: { transactionId } or { features: { Amount, Time, V1..V28 } }
 *          Returns: { riskScore, band, factors }
 *
 * Batch  : POST /api/predict/batch/
 *          Body: multipart/form-data with 'file' (CSV)
 *          Returns: { processedCount, flaggedCount, fraudCount, results }
 *          (Batch CSV upload is also exposed via batchScoreTransactions in transactions.js)
 */

import { delay }     from '../utils/delay.js'
import apiClient     from './apiClient.js'
import { THRESHOLD, REVIEW_FLOOR } from '../config/constants.js'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// POST /api/predict/
// Body: { transactionId } | { features: { Amount, Time, ...V-fields } }
// Returns: { riskScore, band, factors: [{ feature, impact, description, direction }], modelLatencyMs }
export async function predictFraud(transactionPayload) {
  if (!USE_MOCK) {
    const { data } = await apiClient.post('/predict/', transactionPayload)
    // Normalise: backend must return { riskScore, band, factors }
    return {
      riskScore:        data.riskScore ?? data.risk_score ?? 0,
      band:             data.band      ?? (data.riskScore >= THRESHOLD ? 'FRAUD' : data.riskScore >= REVIEW_FLOOR ? 'SUSPICIOUS' : 'LEGIT'),
      factors:          data.factors   ?? [],
      actionRecommended: data.actionRecommended ?? data.action_recommended ?? 'APPROVE',
      modelLatencyMs:   data.modelLatencyMs     ?? data.latency_ms         ?? null,
    }
  }

  // ── Mock ────────────────────────────────────────────────────────────────────
  await delay(350, 650)
  const txId = transactionPayload.id || transactionPayload.transactionId
  let existingTx = null
  if (txId && mockStore?.transactions) {
    existingTx = mockStore.transactions.find((t) => t.id === txId)
  }

  const amount = Number(
    transactionPayload.amount || transactionPayload.Amount || existingTx?.amountINR || existingTx?.amount || 500,
  )

  let riskScore = 0.08
  if (transactionPayload.riskScore !== undefined) {
    riskScore = Number(transactionPayload.riskScore)
  } else if (existingTx?.riskScore !== undefined) {
    riskScore = Number(existingTx.riskScore)
  } else {
    if (amount > 50000) riskScore += 0.55
    else if (amount > 15000) riskScore += 0.35

    if (transactionPayload.isNewDevice) riskScore += 0.18
    if (transactionPayload.isForeignIp) riskScore += 0.22

    riskScore = Math.min(0.99, Math.max(0.01, Number((riskScore + (Math.random() * 0.1 - 0.05)).toFixed(3))))
  }

  const band = riskScore >= THRESHOLD ? 'FRAUD' : riskScore >= REVIEW_FLOOR ? 'SUSPICIOUS' : 'LEGIT'

  return {
    riskScore,
    band,
    actionRecommended: riskScore >= THRESHOLD ? 'BLOCK' : riskScore >= REVIEW_FLOOR ? 'CHALLENGE_OTP' : 'APPROVE',
    factors: [
      {
        feature:     'Amount',
        impact:      amount > 15000 ? 0.32 : -0.15,
        description: `Transaction value ₹${amount.toLocaleString('en-IN')} relative to customer baseline`,
        direction:   amount > 15000 ? 'risk_increasing' : 'risk_decreasing',
      },
      {
        feature:     'V14',
        impact:      0.22,
        description: 'PCA feature 14 variance from standard spending vector',
        direction:   'risk_increasing',
      },
      {
        feature:     'Time',
        impact:      -0.09,
        description: 'Normal daylight operating hours',
        direction:   'risk_decreasing',
      },
    ],
    modelLatencyMs: 16.8,
  }
}

// POST /api/predict/batch/
// Body: multipart/form-data with 'file' (CSV)
// Returns: { processedCount, flaggedCount, fraudCount, results: [{ riskScore, band, factors }] }
export async function predictBatch(file) {
  if (!USE_MOCK) {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await apiClient.post('/predict/batch/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  }

  // Mock: re-use the single predict logic on dummy rows
  await delay(800, 1400)
  const rowCount  = Math.floor(50 + Math.random() * 200)
  const results   = Array.from({ length: rowCount }, (_, idx) => {
    const riskScore = Number((Math.random()).toFixed(3))
    return {
      rowIndex:   idx + 1,
      riskScore,
      band:       riskScore >= THRESHOLD ? 'FRAUD' : riskScore >= REVIEW_FLOOR ? 'SUSPICIOUS' : 'LEGIT',
      factors:    [{ feature: 'Amount', impact: riskScore >= REVIEW_FLOOR ? 0.4 : -0.2, description: 'Amount factor', direction: riskScore >= REVIEW_FLOOR ? 'risk_increasing' : 'risk_decreasing' }],
    }
  })

  return {
    processedCount: results.length,
    flaggedCount:   results.filter((r) => r.riskScore >= REVIEW_FLOOR).length,
    fraudCount:     results.filter((r) => r.riskScore >= THRESHOLD).length,
    results,
  }
}
