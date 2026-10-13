import { mockStore } from '../mock/index.js'
import { delay } from '../utils/delay.js'

/**
 * REST Endpoint: GET /api/v1/disputes/
 */
export async function getDisputes(params = {}) {
  await delay(300, 600)
  const { customerId = null, status = 'ALL' } = params

  let list = [...mockStore.disputes]
  if (customerId) {
    list = list.filter((d) => d.customerId === customerId)
  }
  if (status !== 'ALL') {
    list = list.filter((d) => d.status === status)
  }
  return list
}

/**
 * REST Endpoint: POST /api/v1/disputes/
 */
export async function createDispute({ transactionId, customerId, customerName, amountINR, reason, evidenceNotes }) {
  await delay(450, 750)
  const newDispute = {
    id: `DSP-${Date.now().toString().slice(-4)}`,
    disputeId: `DSP-${Date.now().toString().slice(-4)}`,
    transactionId,
    customerId,
    customerName: customerName || 'Customer',
    amountINR: Number(amountINR),
    reason,
    status: 'Submitted',
    filedAt: new Date().toISOString(),
    evidenceNotes: evidenceNotes || '',
  }

  mockStore.disputes.unshift(newDispute)
  return newDispute
}

/**
 * REST Endpoint: PATCH /api/v1/disputes/:id/status/
 */
export async function updateDisputeStatus(id, newStatus) {
  await delay(350, 650)
  const d = mockStore.disputes.find((item) => item.id === id)
  if (!d) throw new Error(`Dispute ${id} not found`)

  d.status = newStatus
  return d
}
