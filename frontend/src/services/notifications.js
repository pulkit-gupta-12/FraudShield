import { mockStore } from '../mock/index.js'
import { delay } from '../utils/delay.js'

/**
 * REST Endpoint: GET /api/v1/notifications/
 */
export async function getNotifications() {
  await delay(250, 450)
  return [...mockStore.notifications]
}

/**
 * REST Endpoint: PATCH /api/v1/notifications/:id/read/
 */
export async function markNotificationRead(id) {
  await delay(200, 350)
  const n = mockStore.notifications.find((item) => item.id === id)
  if (n) {
    n.read = true
  }
  return n
}

/**
 * REST Endpoint: POST /api/v1/notifications/mark-all-read/
 */
export async function markAllNotificationsRead() {
  await delay(250, 400)
  mockStore.notifications.forEach((n) => {
    n.read = true
  })
  return { success: true }
}
