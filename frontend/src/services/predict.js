import { delay } from '../utils/delay.js'

/**
 * REST Endpoint: POST /api/v1/predict/
 * Receives single transaction payload: { amount, merchant, cardLast4, v1...v28 }
 */
export async function predictFraud(transactionPayload) {
  await delay(350, 650)
  const amount = Number(transactionPayload.amount || transactionPayload.Amount || 500)
  
  // Heuristic mock scoring
  let riskScore = 0.08
  if (amount > 50000) riskScore += 0.55
  else if (amount > 15000) riskScore += 0.35

  if (transactionPayload.isNewDevice) riskScore += 0.18
  if (transactionPayload.isForeignIp) riskScore += 0.22

  // Add small noise
  riskScore = Math.min(0.99, Math.max(0.01, Number((riskScore + (Math.random() * 0.1 - 0.05)).toFixed(3))))

  const label = riskScore >= 0.70 ? 'FRAUD' : riskScore >= 0.40 ? 'SUSPICIOUS' : 'LEGIT'

  return {
    riskScore,
    label,
    actionRecommended: riskScore >= 0.70 ? 'BLOCK' : riskScore >= 0.40 ? 'CHALLENGE_OTP' : 'APPROVE',
    factors: [
      {
        feature: 'Amount',
        impact: amount > 15000 ? 0.32 : -0.15,
        description: `Transaction value ₹${amount.toLocaleString('en-IN')} relative to customer baseline`,
        direction: amount > 15000 ? 'risk_increasing' : 'risk_decreasing',
      },
      {
        feature: 'V14',
        impact: 0.22,
        description: 'PCA feature 14 variance from standard spending vector',
        direction: 'risk_increasing',
      },
      {
        feature: 'Time',
        impact: -0.09,
        description: 'Normal daylight operating hours',
        direction: 'risk_decreasing',
      },
    ],
    modelLatencyMs: 16.8,
  }
}
