import { mockStore } from '../mock/index.js'
import { delay } from '../utils/delay.js'

/**
 * REST Endpoint: GET /api/v1/cases/
 */
export async function getCases(params = {}) {
  await delay(300, 600)
  const { status = 'ALL', priority = 'ALL' } = params

  let list = [...mockStore.cases]
  if (status !== 'ALL') {
    list = list.filter((c) => c.status === status)
  }
  if (priority !== 'ALL') {
    list = list.filter((c) => c.priority === priority)
  }

  return list
}

/**
 * REST Endpoint: GET /api/v1/cases/:id/
 */
export async function getCaseById(id) {
  await delay(300, 500)
  const c = mockStore.cases.find((item) => item.id === id)
  if (!c) throw new Error(`Case ${id} not found`)
  return c
}

/**
 * REST Endpoint: POST /api/v1/cases/:id/notes/
 */
export async function addCaseNote(caseId, authorName, text) {
  await delay(350, 650)
  const c = mockStore.cases.find((item) => item.id === caseId)
  if (!c) throw new Error(`Case ${caseId} not found`)

  const newNote = {
    id: `note_${Date.now()}`,
    author: authorName || 'Analyst',
    timestamp: new Date().toISOString(),
    text,
  }
  c.notes.push(newNote)
  c.timeline.push({
    id: `tl_${Date.now()}`,
    timestamp: new Date().toISOString(),
    action: 'Note Added',
    user: authorName || 'Analyst',
    note: text,
  })

  return newNote
}

/**
 * REST Endpoint: PATCH /api/v1/cases/:id/status/
 */
export async function updateCaseStatus(caseId, newStatus, user = 'Analyst') {
  await delay(400, 700)
  const c = mockStore.cases.find((item) => item.id === caseId)
  if (!c) throw new Error(`Case ${caseId} not found`)

  c.status = newStatus
  c.updatedAt = new Date().toISOString()
  c.timeline.push({
    id: `tl_${Date.now()}`,
    timestamp: new Date().toISOString(),
    action: `Status Changed to ${newStatus}`,
    user,
    note: `Case transitioned to ${newStatus}`,
  })

  return c
}
