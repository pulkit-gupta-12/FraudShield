/**
 * alerts.js
 *
 * List  : GET /api/alerts/
 *         Params: { page, pageSize, search, ordering, status, severity }
 *         Returns: { results: Alert[], count: number }
 *
 * Update: PATCH /api/alerts/{id}/  body: { status }
 */

import { mockStore } from '../mock/index.js'
import { delay }     from '../utils/delay.js'
import apiClient     from './apiClient.js'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// GET /api/alerts/
export async function getAlerts(params = {}) {
  if (!USE_MOCK) {
    const { data } = await apiClient.get('/alerts/', { params })
    return data // { results, count }
  }

  await delay(300, 600)
  const {
    page = 1,
    pageSize = 20,
    search = '',
    ordering = '',
    status = 'ALL',
    severity = 'ALL',
    userId = null,
    customerId = null,
    customerName = null,
  } = params

  let list = [...mockStore.alerts]

  if (status !== 'ALL')   list = list.filter((a) => a.status === status)
  if (severity !== 'ALL') list = list.filter((a) => a.severity === severity)

  if (userId) {
    const userObj = mockStore.users?.find((u) => u.id === userId)
    const userTxnIds = new Set(
      mockStore.transactions.filter((t) => t.userId === userId).map((t) => t.id),
    )
    list = list.filter(
      (a) =>
        a.userId === userId ||
        userTxnIds.has(a.transactionId) ||
        (userObj && a.customerName?.toLowerCase() === userObj.name.toLowerCase()),
    )
  } else if (customerId) {
    list = list.filter((a) => a.customerId === customerId || a.userId === customerId)
  } else if (customerName) {
    list = list.filter((a) => a.customerName?.toLowerCase() === customerName.toLowerCase())
  }

  if (search) {
    const q = search.toLowerCase()
    list = list.filter(
      (a) =>
        a.id?.toLowerCase().includes(q)             ||
        a.customerName?.toLowerCase().includes(q)   ||
        a.merchant?.toLowerCase().includes(q)       ||
        a.transactionId?.toLowerCase().includes(q),
    )
  }

  if (ordering) {
    const desc = ordering.startsWith('-')
    const key  = desc ? ordering.slice(1) : ordering
    list.sort((a, b) => {
      const av = a[key], bv = b[key]
      if (av === bv) return 0
      return (av > bv ? 1 : -1) * (desc ? -1 : 1)
    })
  }

  const count  = list.length
  const start  = (Number(page) - 1) * Number(pageSize)
  const results = list.slice(start, start + Number(pageSize))

  return { results, count }
}

// PATCH /api/alerts/{id}/
export async function updateAlert(id, updates = {}) {
  if (!USE_MOCK) {
    const { data } = await apiClient.patch(`/alerts/${id}/`, updates)
    return data
  }

  await delay(350, 650)
  const alert = mockStore.alerts.find((a) => a.id === id)
  if (!alert) {
    const err = new Error(`Alert ${id} not found`)
    err.status = 404
    throw err
  }
  Object.assign(alert, updates)
  return alert
}

export async function updateAlertStatus(id, newStatus) {
  return updateAlert(id, { status: newStatus })
}

