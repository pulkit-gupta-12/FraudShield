/**
 * merchants.js
 *
 * GET /api/merchants/
 * POST /api/merchants/
 * PATCH /api/merchants/{id}/
 */

import apiClient from './apiClient.js'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

export async function getMerchants(params = {}) {
  if (!USE_MOCK) {
    const { data } = await apiClient.get('/merchants/', { params })
    return Array.isArray(data) ? { results: data, count: data.length } : data
  }

  return {
    results: [
      { id: 1, name: 'Reliance Digital', category: 'Electronics', city: 'Mumbai', active: true },
      { id: 2, name: 'Croma', category: 'Electronics', city: 'Bengaluru', active: true },
      { id: 3, name: 'BigBasket', category: 'Grocery', city: 'Delhi', active: true },
      { id: 4, name: 'Taj Hotels', category: 'Hospitality', city: 'Mumbai', active: true },
      { id: 5, name: 'Zomato Online', category: 'Dining', city: 'Gurugram', active: true },
    ],
    count: 5,
  }
}

export async function createMerchant(merchantData) {
  if (!USE_MOCK) {
    const { data } = await apiClient.post('/merchants/', merchantData)
    return data
  }
  return { id: Date.now(), ...merchantData, active: true }
}

export async function updateMerchant(id, merchantData) {
  if (!USE_MOCK) {
    const { data } = await apiClient.patch(`/merchants/${id}/`, merchantData)
    return data
  }
  return { id, ...merchantData }
}
