/**
 * patterns.js
 *
 * GET /api/patterns/
 * Returns 20 real spending patterns extracted from the dataset.
 */

import apiClient from './apiClient.js'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

export async function getPatterns() {
  if (!USE_MOCK) {
    const { data } = await apiClient.get('/patterns/')
    return Array.isArray(data) ? data : data.results || []
  }

  // Mock fallback if needed
  return [
    { id: 1, code: 'P01', label: 'Spending pattern 01', typicalAmount: 14.50, typicalTime: '10:00 AM', baseScore: 0.012, trueLabel: 'LEGIT' },
    { id: 2, code: 'P02', label: 'Spending pattern 02', typicalAmount: 48.00, typicalTime: '02:30 PM', baseScore: 0.045, trueLabel: 'LEGIT' },
    { id: 3, code: 'P03', label: 'Spending pattern 03', typicalAmount: 120.00, typicalTime: '07:15 PM', baseScore: 0.089, trueLabel: 'LEGIT' },
    { id: 4, code: 'P04', label: 'Spending pattern 04', typicalAmount: 250.00, typicalTime: '11:45 PM', baseScore: 0.420, trueLabel: 'SUSPICIOUS' },
    { id: 5, code: 'P05', label: 'Spending pattern 05', typicalAmount: 890.00, typicalTime: '03:10 AM', baseScore: 0.940, trueLabel: 'FRAUD' },
  ]
}
