import { mockStore } from '../mock/index.js'
import { delay } from '../utils/delay.js'

/**
 * REST Endpoint: GET /api/v1/cards/
 */
export async function getCards(params = {}) {
  await delay(300, 600)
  const { userId = null, status = 'ALL' } = params

  let list = [...mockStore.cards]
  if (userId) {
    list = list.filter((c) => c.userId === userId)
  }
  if (status !== 'ALL') {
    list = list.filter((c) => c.status === status)
  }
  return list
}

/**
 * REST Endpoint: PATCH /api/v1/cards/:id/status/
 */
export async function updateCardStatus(cardId, newStatus) {
  await delay(350, 650)
  const card = mockStore.cards.find((c) => c.id === cardId)
  if (!card) throw new Error(`Card ${cardId} not found`)

  card.status = newStatus
  return card
}
