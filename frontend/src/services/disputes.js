/**
 * disputes.js
 *
 * List  : GET /api/disputes/
 *         Params: { page, pageSize, search, ordering, status, customerId }
 *         Returns: { results: Dispute[], count: number }
 *
 * Create: POST /api/disputes/   body: { transactionId, customerId, customerName, amountINR, reason, evidenceNotes }
 * Update: PATCH /api/disputes/{id}/status/  body: { status }
 */

import { mockStore } from '../mock/index.js'
import { delay }     from '../utils/delay.js'
import apiClient     from './apiClient.js'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// GET /api/disputes/
export async function getDisputes(params = {}) {
  if (!USE_MOCK) {
    const { data } = await apiClient.get('/disputes/', { params })
    return data // { results, count }
  }

  await delay(300, 600)
  const { page = 1, pageSize = 20, search = '', ordering = '', status = 'ALL', customerId = null } = params

  let list = [...mockStore.disputes]

  if (customerId)       list = list.filter((d) => d.customerId === customerId)
  if (status !== 'ALL') list = list.filter((d) => d.status === status)

  if (search) {
    const q = search.toLowerCase()
    list = list.filter(
      (d) =>
        d.id?.toLowerCase().includes(q)           ||
        d.customerName?.toLowerCase().includes(q) ||
        d.transactionId?.toLowerCase().includes(q)||
        d.reason?.toLowerCase().includes(q),
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

// POST /api/disputes/
export async function createDispute({ transactionId, customerId, customerName, amountINR, reason, evidenceNotes }) {
  if (!USE_MOCK) {
    const { data } = await apiClient.post('/disputes/', {
      transactionId, customerId, customerName, amountINR: Number(amountINR), reason, evidenceNotes,
    })
    return data
  }

  await delay(450, 750)
  const id = `DSP-${Date.now().toString().slice(-4)}`
  const newDispute = {
    id,
    disputeId:      id,
    transactionId,
    customerId,
    customerName:   customerName || 'Customer',
    amountINR:      Number(amountINR),
    reason,
    status:         'Submitted',
    filedAt:        new Date().toISOString(),
    evidenceNotes:  evidenceNotes || '',
  }

  mockStore.disputes.unshift(newDispute)
  return newDispute
}

// PATCH /api/disputes/{id}/status/  body: { status }
export async function updateDisputeStatus(id, newStatus) {
  if (!USE_MOCK) {
    const { data } = await apiClient.patch(`/disputes/${id}/status/`, { status: newStatus })
    return data
  }

  await delay(350, 650)
  const d = mockStore.disputes.find((item) => item.id === id)
  if (!d) {
    const err = new Error(`Dispute ${id} not found`)
    err.status = 404
    throw err
  }
  d.status = newStatus
  return d
}

// POST /api/disputes/{id}/evidence/
// body: FormData or { files: Array, notes: string }
export async function uploadDisputeEvidence(id, { files = [], notes = '' } = {}) {
  if (!USE_MOCK) {
    const formData = new FormData()
    files.forEach((f) => formData.append('files', f))
    if (notes) formData.append('notes', notes)
    const { data } = await apiClient.post(`/disputes/${id}/evidence/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  }

  await delay(450, 800)
  const d = mockStore.disputes.find((item) => item.id === id)
  if (!d) {
    const err = new Error(`Dispute ${id} not found`)
    err.status = 404
    throw err
  }

  if (!d.evidenceFiles) d.evidenceFiles = []
  const uploadedMeta = files.map((f) => ({
    name: f.name || 'document.pdf',
    size: f.size || 1024 * 50,
    uploadedAt: new Date().toISOString(),
  }))
  d.evidenceFiles.push(...uploadedMeta)
  if (notes) {
    d.evidenceNotes = d.evidenceNotes ? `${d.evidenceNotes}\n${notes}` : notes
  }

  // Advance status from 'Pending' / 'Needs Response' to 'Evidence Submitted' or 'Under Review'
  if (d.status === 'Pending' || d.status === 'Needs Response' || d.status === 'Submitted') {
    d.status = 'Evidence Submitted'
  }

  return d
}

// GET /api/disputes/{id}/evidence/{evidenceId}/
// Downloads the evidence file as a blob through the authenticated endpoint
export async function downloadDisputeEvidence(disputeId, evidenceId, filename = 'evidence_document') {
  if (!USE_MOCK) {
    const response = await apiClient.get(`/disputes/${disputeId}/evidence/${evidenceId}/`, {
      responseType: 'blob',
    })
    const blob = new Blob([response.data], {
      type: response.headers['content-type'] || 'application/octet-stream',
    })
    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(downloadUrl)
    return blob
  }

  await delay(200, 400)
  const dummyContent = 'Mock dispute evidence document content'
  const blob = new Blob([dummyContent], { type: 'text/plain' })
  const downloadUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = filename || 'mock_evidence.txt'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(downloadUrl)
  return blob
}

