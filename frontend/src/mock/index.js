import {
  generateUsers,
  generateCards,
  generateTransactions,
  generateAlerts,
  generateCases,
  generateDisputes,
  generateAuditLogs,
  generateNotifications,
  MODEL_INFO,
} from './generator.js'

// Deterministic in-memory database
class MockStore {
  constructor() {
    this.reset()
  }

  reset() {
    this.users = generateUsers()
    this.cards = generateCards(this.users)
    this.transactions = generateTransactions(this.users, this.cards)
    this.alerts = generateAlerts(this.transactions)
    this.cases = generateCases(this.transactions, this.users)
    this.disputes = generateDisputes(this.transactions)
    this.auditLogs = generateAuditLogs(this.users)
    this.notifications = generateNotifications()
    this.modelInfo = JSON.parse(JSON.stringify(MODEL_INFO))
    this.config = {
      suspiciousThreshold: 0.40,
      fraudThreshold: 0.70,
      selectedModel: 'xgb-fraud-v2.4.1',
      alertEmails: ['alerts@fraudshield.io', 'security-ops@fraudshield.io'],
      featureFlags: {
        enableBatchScoring: true,
        enableAutoBlock: false,
        enableSmsOtpChallenge: true,
        enableRealtimeWebhooks: true,
      },
    }
  }
}

export const mockStore = new MockStore()
