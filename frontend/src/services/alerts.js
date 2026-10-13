import { mockStore } from '../mock/index.js'
import { delay } from '../utils/delay.js'

/**
 * REST Endpoint: GET /api/v1/alerts/
 */
export async function getAlerts(params = {}) {
  await delay(300, 600)
  const { status = 'ALL', severity = 'ALL' } = params

  let list = [...mockStore.alerts]
  if (status !== 'ALL') {
    list = list.filter((a) => a.status === status)
  }
  if (severity !== 'ALL') {
    list = list.filter((a) => a.severity === severity)
  }

  return list
}

/**
 * REST Endpoint: PATCH /api/v1/alerts/:id/
 */
export async function updateAlertStatus(id, newStatus) {
  await delay(350, 650)
  const alert = mockStore.alerts.find((a) => a.id === id)
  if (!alert) throw new Error(`Alert ${id} not found`)

  alert.status = newStatus
  return alert
}
