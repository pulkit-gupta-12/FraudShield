/**
 * auditLogs.js
 *
 * List  : GET /api/audit-logs/
 *         Params: { page, pageSize, search, ordering, action, status }
 *         Returns: { results: AuditLog[], count: number }
 *
 * Create: POST /api/audit-logs/
 *         Body: { action, target, actor, details, status }
 */

import { mockStore } from '../mock/index.js'
import { delay }     from '../utils/delay.js'
import apiClient     from './apiClient.js'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// GET /api/audit-logs/
export async function getAuditLogs(params = {}) {
  if (!USE_MOCK) {
    const { data } = await apiClient.get('/audit-logs/', { params })
    return data // { results, count }
  }

  await delay(250, 500)
  const {
    page = 1,
    pageSize = 20,
    search = '',
    ordering = '-timestamp',
    action = 'ALL',
    status = 'ALL',
  } = params

  let list = [...mockStore.auditLogs]

  if (action !== 'ALL') {
    list = list.filter((l) => l.action === action)
  }

  if (status !== 'ALL') {
    list = list.filter((l) => l.status === status)
  }

  if (search) {
    const q = search.toLowerCase()
    list = list.filter(
      (l) =>
        l.id?.toLowerCase().includes(q) ||
        l.actor?.toLowerCase().includes(q) ||
        l.action?.toLowerCase().includes(q) ||
        l.target?.toLowerCase().includes(q) ||
        l.details?.toLowerCase().includes(q) ||
        l.ipAddress?.includes(q)
    )
  }

  if (ordering) {
    const desc = ordering.startsWith('-')
    const key = desc ? ordering.slice(1) : ordering
    list.sort((a, b) => {
      const av = a[key] ?? ''
      const bv = b[key] ?? ''
      if (av === bv) return 0
      return (av > bv ? 1 : -1) * (desc ? -1 : 1)
    })
  }

  const count = list.length
  const start = (Number(page) - 1) * Number(pageSize)
  const results = list.slice(start, start + Number(pageSize))

  return { results, count }
}

// POST /api/audit-logs/
export async function recordAuditLog(logEntry) {
  if (!USE_MOCK) {
    const { data } = await apiClient.post('/audit-logs/', logEntry)
    return data
  }

  await delay(150, 300)
  const newLog = {
    id: `LOG-${Date.now().toString().slice(-6)}`,
    timestamp: new Date().toISOString(),
    ipAddress: '127.0.0.1',
    status: 'SUCCESS',
    ...logEntry,
  }

  mockStore.auditLogs.unshift(newLog)
  return newLog
}
