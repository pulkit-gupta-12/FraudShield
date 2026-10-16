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

// PATCH /api/model/thresholds/  body: { suspicious, fraud }
export async function updateThresholds(suspicious, fraud) {
  if (!USE_MOCK) {
    const { data } = await apiClient.patch('/model/thresholds/', {
      suspicious: Number(suspicious),
      fraud:      Number(fraud),
    })
    return data
  }

  await delay(300, 500)
  mockStore.config.suspiciousThreshold = Number(suspicious)
  mockStore.config.fraudThreshold      = Number(fraud)
  mockStore.config.reviewFloor         = Number(suspicious)
  mockStore.config.threshold           = Number(fraud)
  mockStore.THRESHOLD                  = Number(fraud)
  mockStore.REVIEW_FLOOR               = Number(suspicious)

  mockStore.auditLogs.unshift({
    id:        `LOG-${Date.now()}`,
    timestamp: new Date().toISOString(),
    actor:     'Admin User',
    actorRole: 'admin',
    action:    'THRESHOLDS_UPDATED',
    target:    'RiskEngine',
    ipAddress: '103.44.11.1',
    status:    'SUCCESS',
    details:   `Updated risk thresholds: reviewFloor=${suspicious}, threshold=${fraud}. Recalibrated precision/recall trade-off.`,
  })

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('threshold-updated', {
      detail: {
        suspicious: Number(suspicious),
        fraud: Number(fraud),
        reviewFloor: Number(suspicious),
        threshold: Number(fraud),
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
