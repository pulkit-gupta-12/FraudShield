/**
 * notifications.js
 *
 * List     : GET /api/notifications/
 *            Params: { page, pageSize }
 *            Returns: { results: Notification[], count: number }
 *
 * ReadOne  : PATCH /api/notifications/{id}/read/
 * ReadAll  : POST  /api/notifications/mark-all-read/
 */

import { mockStore } from '../mock/index.js'
import { delay }     from '../utils/delay.js'
import apiClient     from './apiClient.js'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// GET /api/notifications/
export async function getNotifications(params = {}) {
  if (!USE_MOCK) {
    const { data } = await apiClient.get('/notifications/', { params })
    return data // { results, count }
  }

  await delay(250, 450)
  const { page = 1, pageSize = 50 } = params
  const list    = [...mockStore.notifications]
  const count   = list.length
  const start   = (Number(page) - 1) * Number(pageSize)
  const results = list.slice(start, start + Number(pageSize))
  return { results, count }
}

// PATCH /api/notifications/{id}/read/
export async function markNotificationRead(id) {
  if (!USE_MOCK) {
    const { data } = await apiClient.patch(`/notifications/${id}/read/`)
    return data
  }

  await delay(200, 350)
  const n = mockStore.notifications.find((item) => item.id === id)
  if (n) n.read = true
  return n
}

// POST /api/notifications/
export async function createNotification(notification) {
  if (!USE_MOCK) {
    const { data } = await apiClient.post('/notifications/', notification)
    return data
  }

  await delay(200, 350)
  const newNotif = {
    id: `notif_${Date.now()}`,
    ...notification,
    createdAt: new Date().toISOString(),
    read: false,
  }
  mockStore.notifications.unshift(newNotif)
  return newNotif
}

// POST /api/notifications/mark-all-read/
export async function markAllNotificationsRead() {
  if (!USE_MOCK) {
    const { data } = await apiClient.post('/notifications/mark-all-read/')
    return data
  }

  await delay(250, 400)
  mockStore.notifications.forEach((n) => { n.read = true })
  return { success: true }
}

