/**
 * cards.js
 *
 * List  : GET /api/cards/
 *         Params: { page, pageSize, search, ordering, userId, status }
 *         Returns: { results: Card[], count: number }
 *
 * Update: PATCH /api/cards/{id}/status/  body: { status }
 */

import { mockStore } from '../mock/index.js'
import { delay }     from '../utils/delay.js'
import apiClient     from './apiClient.js'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// GET /api/cards/
export async function getCards(params = {}) {
  if (!USE_MOCK) {
    const { data } = await apiClient.get('/cards/', { params })
    return data // { results, count }
  }

  await delay(300, 600)
  const { page = 1, pageSize = 20, search = '', ordering = '', userId = null, status = 'ALL' } = params

  let list = [...mockStore.cards]

  if (userId)           list = list.filter((c) => c.userId === userId)
  if (status !== 'ALL') list = list.filter((c) => c.status === status)

  if (search) {
    const q = search.toLowerCase()
    list = list.filter(
      (c) =>
        c.cardNumber?.includes(q)                  ||
        c.cardType?.toLowerCase().includes(q)      ||
        c.holderName?.toLowerCase().includes(q),
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

// PATCH /api/cards/{id}/status/  body: { status }
export async function updateCardStatus(cardId, newStatus) {
  if (!USE_MOCK) {
    const { data } = await apiClient.patch(`/cards/${cardId}/status/`, { status: newStatus })
    return data
  }

  await delay(350, 650)
  const card = mockStore.cards.find((c) => c.id === cardId)
  if (!card) {
    const err = new Error(`Card ${cardId} not found`)
    err.status = 404
    throw err
  }
  card.status = newStatus
  return card
}
