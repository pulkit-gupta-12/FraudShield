import { mockStore } from '../mock/index.js'
import { delay } from '../utils/delay.js'

/**
 * REST Endpoint: GET /api/v1/model/info/
 */
export async function getModelInfo() {
  await delay(300, 500)
  return mockStore.modelInfo
}

/**
 * REST Endpoint: POST /api/v1/model/retrain/
 */
export async function triggerRetraining() {
  await delay(700, 1100)
  mockStore.modelInfo.metrics.f1Score = Number((0.873 + Math.random() * 0.008).toFixed(3))
  mockStore.modelInfo.trainedDate = new Date().toISOString()
  mockStore.auditLogs.unshift({
    id: `LOG-${Date.now()}`,
    timestamp: new Date().toISOString(),
    actor: 'Lead Analyst',
    actorRole: 'analyst',
    action: 'MODEL_RETRAIN_TRIGGERED',
    target: mockStore.modelInfo.version,
    ipAddress: '103.44.11.22',
    status: 'SUCCESS',
    details: 'Initiated distributed XGBoost hyperparameter tuning & cross-validation job.',
  })

  return {
    status: 'TRAINING_STARTED',
    jobId: `job_retrain_${Date.now()}`,
    estimatedDuration: '4 mins 30 secs',
    version: mockStore.modelInfo.version,
  }
}

/**
 * REST Endpoint: PATCH /api/v1/model/thresholds/
 */
export async function updateThresholds(suspicious, fraud) {
  await delay(400, 600)
  mockStore.config.suspiciousThreshold = Number(suspicious)
  mockStore.config.fraudThreshold = Number(fraud)

  mockStore.auditLogs.unshift({
    id: `LOG-${Date.now()}`,
    timestamp: new Date().toISOString(),
    actor: 'Admin User',
    actorRole: 'admin',
    action: 'THRESHOLDS_UPDATED',
    target: 'RiskEngine',
    ipAddress: '103.44.11.1',
    status: 'SUCCESS',
    details: `Updated thresholds: suspicious=${suspicious}, fraud=${fraud}`,
  })

  return mockStore.config
}

/**
 * REST Endpoint: GET /api/v1/model/config/
 */
export async function getSystemConfig() {
  await delay(250, 450)
  return mockStore.config
}
