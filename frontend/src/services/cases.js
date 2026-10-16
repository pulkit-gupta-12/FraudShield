/**
 * cases.js
 *
 * List  : GET /api/cases/
 *         Params: { page, pageSize, search, ordering, status, priority }
 *         Returns: { results: Case[], count: number }
 *
 * Detail: GET /api/cases/{id}/
 * Note  : POST /api/cases/{id}/notes/
 * Status: PATCH /api/cases/{id}/status/  body: { status }
 */

import { mockStore } from '../mock/index.js'
import { delay }     from '../utils/delay.js'
import apiClient     from './apiClient.js'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// GET /api/cases/
export async function getCases(params = {}) {
  if (!USE_MOCK) {
    const { data } = await apiClient.get('/cases/', { params })
    return data // { results, count }
  }

  await delay(300, 600)
  const { page = 1, pageSize = 20, search = '', ordering = '', status = 'ALL', priority = 'ALL' } = params

  let list = [...mockStore.cases]

  if (status !== 'ALL')   list = list.filter((c) => c.status === status)
  if (priority !== 'ALL') list = list.filter((c) => c.priority === priority)

  if (search) {
    const q = search.toLowerCase()
    list = list.filter(
      (c) =>
        c.id?.toLowerCase().includes(q)              ||
        c.customerName?.toLowerCase().includes(q)    ||
        c.transactionId?.toLowerCase().includes(q),
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

// GET /api/cases/{id}/
export async function getCaseById(id) {
  if (!USE_MOCK) {
    const { data } = await apiClient.get(`/cases/${id}/`)
    return data
  }

  await delay(300, 500)
  const c = mockStore.cases.find((item) => item.id === id)
  if (!c) {
    const err = new Error(`Case ${id} not found`)
    err.status = 404
    throw err
  }
  return c
}

// POST /api/cases/{id}/notes/   body: { text }
export async function addCaseNote(caseId, authorName, text) {
  if (!USE_MOCK) {
    const { data } = await apiClient.post(`/cases/${caseId}/notes/`, { text })
    return data // the new note object
  }

  await delay(350, 650)
  const c = mockStore.cases.find((item) => item.id === caseId)
  if (!c) {
    const err = new Error(`Case ${caseId} not found`)
    err.status = 404
    throw err
  }

  const newNote = {
    id:        `note_${Date.now()}`,
    author:    authorName || 'Analyst',
    timestamp: new Date().toISOString(),
    text,
  }
  c.notes.push(newNote)
  c.timeline.push({
    id:        `tl_${Date.now()}`,
    timestamp: new Date().toISOString(),
    action:    'Note Added',
    user:      authorName || 'Analyst',
    note:      text,
  })

  return newNote
}

// PATCH /api/cases/{id}/status/  body: { status }
export async function updateCaseStatus(caseId, newStatus, user = 'Analyst', reason = '') {
  if (!USE_MOCK) {
    const { data } = await apiClient.patch(`/cases/${caseId}/status/`, { status: newStatus, reason })
    return data
  }

  await delay(350, 600)
  const c = mockStore.cases.find((item) => item.id === caseId)
  if (!c) {
    const err = new Error(`Case ${caseId} not found`)
    err.status = 404
    throw err
  }

  c.status    = newStatus
  c.updatedAt = new Date().toISOString()
  
  // S14 Requirement: Mark Fraud, Mark Safe, Escalate must really change case, alert and transaction
  const txn = mockStore.transactions.find((t) => t.id === c.transactionId)
  const alert = mockStore.alerts.find((a) => a.transactionId === c.transactionId || a.id === c.id)

  let timelineAction = `Status: ${newStatus}`

  if (newStatus === 'Confirmed Fraud' || newStatus === 'Marked as Fraud') {
    c.status = 'Confirmed Fraud'
    timelineAction = 'Marked as Fraud'
    if (txn) {
      txn.status = 'Blocked'
      txn.trueLabel = 'FRAUD'
    }
    if (alert) {
      alert.status = 'fraud_confirmed'
      alert.severity = 'critical'
    }
  } else if (newStatus === 'Confirmed Safe' || newStatus === 'Marked as Safe') {
    c.status = 'Resolved'
    timelineAction = 'Marked as Safe'
    if (txn) {
      txn.status = 'Approved'
      txn.trueLabel = 'LEGIT'
    }
    if (alert) {
      alert.status = 'resolved'
    }
  } else if (newStatus === 'Escalated') {
    c.status = 'Escalated'
    c.priority = 'P1'
    timelineAction = 'Escalated to Senior Ops'
    if (alert) {
      alert.severity = 'critical'
      alert.status = 'investigating'
    }
    if (txn) {
      txn.status = 'Under Review'
    }
  }

  c.timeline.unshift({
    id:        `tl_${Date.now()}`,
    timestamp: new Date().toISOString(),
    action:    timelineAction,
    user,
    note:      reason || `Case transitioned to ${newStatus}`,
  })

  // Write an audit log entry
  mockStore.auditLogs.unshift({
    id:        `LOG-${Date.now()}`,
    timestamp: new Date().toISOString(),
    actor:     user,
    actorRole: 'analyst',
    action:    'CASE_STATUS_UPDATED',
    target:    caseId,
    ipAddress: '103.44.11.35',
    status:    'SUCCESS',
    details:   `Case ${caseId} status changed to ${c.status}. ${reason}`,
  })

  return c
}
