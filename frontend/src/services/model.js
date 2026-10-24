/**
 * model.js
 *
 * Info    : GET /api/model/info/
 * Retrain : POST /api/model/retrain/
 * Thresh  : PATCH /api/model/thresholds/  body: { suspicious, fraud }
 * Config  : GET /api/model/config/
 */

import { mockStore } from '../mock/index.js'
import { delay }     from '../utils/delay.js'
import apiClient     from './apiClient.js'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// GET /api/model/info/
export async function getModelInfo() {
  if (!USE_MOCK) {
    const { data } = await apiClient.get('/model/info/')
    return data
  }

  await delay(300, 500)
  return mockStore.modelInfo
}

// POST /api/model/retrain/
export async function triggerRetraining() {
  if (!USE_MOCK) {
    const { data } = await apiClient.post('/model/retrain/')
    return data
  }

  await delay(700, 1100)
  mockStore.modelInfo.metrics.f1Score = Number((0.873 + Math.random() * 0.008).toFixed(3))
  mockStore.modelInfo.trainedDate     = new Date().toISOString()
  mockStore.auditLogs.unshift({
    id:        `LOG-${Date.now()}`,
    timestamp: new Date().toISOString(),
    actor:     'Lead Analyst',
    actorRole: 'analyst',
    action:    'MODEL_RETRAIN_TRIGGERED',
    target:    mockStore.modelInfo.version,
    ipAddress: '103.44.11.22',
    status:    'SUCCESS',
    details:   'Initiated distributed XGBoost hyperparameter tuning & cross-validation job.',
  })

  return {
    status:            'TRAINING_STARTED',
    jobId:             `job_retrain_${Date.now()}`,
    estimatedDuration: '4 mins 30 secs',
    version:           mockStore.modelInfo.version,
  }
}

// GET /api/model/what-if/?threshold=<val>
export async function getModelWhatIf(threshold) {
  if (!USE_MOCK) {
    const params = threshold !== undefined ? { threshold } : {}
    const { data } = await apiClient.get('/model/what-if/', { params })
    return data
  }

  await delay(200, 350)
  const txns = mockStore.transactions || []
  const tVal = Number(threshold)
  let flagged = 0
  let caught = 0
  let falseAlarms = 0
  let totalFraud = 0
  txns.forEach((t) => {
    const isActualFraud = t.trueLabel === 'FRAUD' || (t.trueLabel == null && (t.riskScore ?? 0) >= 0.89)
    if (isActualFraud) totalFraud++
    if ((t.riskScore ?? 0) >= tVal) {
      flagged++
      if (isActualFraud) caught++
      else falseAlarms++
    }
  })
  const precision = flagged > 0 ? Number((caught / flagged).toFixed(4)) : 0
  const recall = totalFraud > 0 ? Number((caught / totalFraud).toFixed(4)) : 0
  return {
    threshold: tVal,
    totalEvaluated: txns.length,
    flagged,
    caught,
    falseAlarms,
    precision,
    recall,
  }
}

// PUT /api/model/threshold/  body: { threshold, reviewFloor }
export async function updateThresholds(arg1, arg2) {
  let thresholdVal
  let reviewFloorVal

  if (typeof arg1 === 'object' && arg1 !== null) {
    thresholdVal = arg1.threshold ?? arg1.fraud
    reviewFloorVal = arg1.reviewFloor ?? arg1.suspicious ?? arg1.review_floor
  } else {
    // If called as (reviewFloor, threshold) where reviewFloor < threshold
    const num1 = Number(arg1)
    const num2 = Number(arg2)
    if (num1 < num2) {
      reviewFloorVal = num1
      thresholdVal = num2
    } else {
      thresholdVal = num1
      reviewFloorVal = num2
    }
  }

  if (!USE_MOCK) {
    const payload = {
      threshold: Number(thresholdVal),
    }
    if (reviewFloorVal !== undefined && !isNaN(reviewFloorVal)) {
      payload.reviewFloor = Number(reviewFloorVal)
    }

    const { data } = await apiClient.put('/model/threshold/', payload)

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('threshold-updated', {
        detail: {
          suspicious: Number(reviewFloorVal),
          fraud: Number(thresholdVal),
          reviewFloor: Number(reviewFloorVal),
          threshold: Number(thresholdVal),
        },
      }))
    }
    return data
  }

  await delay(300, 500)
  mockStore.config.suspiciousThreshold = Number(reviewFloorVal)
  mockStore.config.fraudThreshold      = Number(thresholdVal)
  mockStore.config.reviewFloor         = Number(reviewFloorVal)
  mockStore.config.threshold           = Number(thresholdVal)
  mockStore.THRESHOLD                  = Number(thresholdVal)
  mockStore.REVIEW_FLOOR               = Number(reviewFloorVal)

  mockStore.auditLogs.unshift({
    id:        `LOG-${Date.now()}`,
    timestamp: new Date().toISOString(),
    actor:     'Admin User',
    actorRole: 'admin',
    action:    'THRESHOLDS_UPDATED',
    target:    'RiskEngine',
    ipAddress: '103.44.11.1',
    status:    'SUCCESS',
    details:   `Updated risk thresholds: reviewFloor=${reviewFloorVal}, threshold=${thresholdVal}. Recalibrated precision/recall trade-off.`,
  })

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('threshold-updated', {
      detail: {
        suspicious: Number(reviewFloorVal),
        fraud: Number(thresholdVal),
        reviewFloor: Number(reviewFloorVal),
        threshold: Number(thresholdVal),
      },
    }))
  }

  return mockStore.config
}

// GET /api/model/config/
export async function getSystemConfig() {
  if (!USE_MOCK) {
    const { data } = await apiClient.get('/model/config/')
    return data
  }

  await delay(250, 450)
  return mockStore.config
}
