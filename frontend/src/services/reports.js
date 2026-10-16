/**
 * reports.js
 *
 * All summary / aggregate data comes from stats endpoints in real mode.
 * This file keeps backward-compatibility for pages that import from reports.js.
 * Internally it delegates to stats.js in real mode.
 *
 * Audit logs: GET /api/audit-logs/
 *             Params: { page, pageSize, search, ordering }
 *             Returns: { results: AuditLog[], count: number }
 */

import { mockStore } from '../mock/index.js'
import { delay }     from '../utils/delay.js'
import apiClient     from './apiClient.js'
import {
  getOverviewStats,
  getTimeseriesStats,
  getMerchantStats,
} from './stats.js'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// GET /api/stats/overview/  (delegated to stats.js)
export { getOverviewStats as getGlobalStats }

// GET /api/stats/timeseries/  (delegated to stats.js)
export async function getDailyTrends(params) {
  return getTimeseriesStats(params)
}

// GET /api/stats/merchant/  (delegated to stats.js)
export async function getTopRiskyMerchants(params) {
  return getMerchantStats(params)
}

// GET /api/audit-logs/
export async function getAuditLogs(params = {}) {
  if (!USE_MOCK) {
    // Support legacy call: getAuditLogs(40) — a plain number limit
    if (typeof params === 'number') params = { pageSize: params }
    const { data } = await apiClient.get('/audit-logs/', { params })
    return data // { results, count }
  }

  await delay(300, 500)

  // Support legacy call with a plain limit number
  if (typeof params === 'number') {
    return {
      results: mockStore.auditLogs.slice(0, params),
      count:   mockStore.auditLogs.length,
    }
  }

  const { page = 1, pageSize = 40, search = '', ordering = '' } = params
  let list = [...mockStore.auditLogs]

  if (search) {
    const q = search.toLowerCase()
    list = list.filter(
      (l) =>
        l.actor?.toLowerCase().includes(q)   ||
        l.action?.toLowerCase().includes(q)  ||
        l.target?.toLowerCase().includes(q)  ||
        l.details?.toLowerCase().includes(q),
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

  const count   = list.length
  const start   = (Number(page) - 1) * Number(pageSize)
  const results = list.slice(start, start + Number(pageSize))

  return { results, count }
}
