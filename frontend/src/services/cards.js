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

// GET /api/pos/cards/
export async function getPOSCards() {
  if (!USE_MOCK) {
    const { data } = await apiClient.get('/pos/cards/')
    return Array.isArray(data) ? data : data.results || []
  }

  await delay(200, 400)
  return mockStore.cards.map((c) => ({
    id: c.id,
    brand: c.brand || c.cardType || 'Visa',
    last4: c.last4 || c.cardNumber?.slice(-4) || '1234',
    cardholderFirstName: (c.holderName || 'Customer').split(' ')[0],
    spendingLimit: c.spendingLimit || 50000,
  }))
}

// POST /api/cards/ (admin only)
export async function issueCard(cardData) {
  if (!USE_MOCK) {
    const { data } = await apiClient.post('/cards/', cardData)
    return data
  }

  await delay(300, 500)
  const newCard = {
    id: Date.now(),
    ownerId: cardData.userId || cardData.ownerId,
    brand: cardData.brand || 'Visa',
    cardType: cardData.cardType || `${cardData.brand || 'Visa'} Platinum`,
    last4: String(Math.floor(1000 + Math.random() * 9000)),
    spendingLimit: Number(cardData.spendingLimit) || 100000,
    status: 'active',
    createdAt: new Date().toISOString(),
  }
  mockStore.cards.unshift(newCard)
  return newCard
}

