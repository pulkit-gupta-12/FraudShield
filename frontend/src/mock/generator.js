// Seeded pseudo-random generator (Mulberry32)
function createPrng(seed = 1337) {
  let s = seed
  return function () {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rng = createPrng(42)

const FIRST_NAMES = [
  'Aarav', 'Priya', 'Rohan', 'Ananya', 'Vikram', 'Sneha', 'Arjun', 'Kavita',
  'Rajesh', 'Pooja', 'Aditya', 'Neha', 'Kabir', 'Divya', 'Siddharth', 'Tanvi',
  'Amit', 'Meera', 'Varun', 'Sunita', 'Naveen', 'Ritu', 'Kunal', 'Deepika',
  'Manish', 'Shweta', 'Abhishek', 'Isha', 'Suresh', 'Anjali', 'Karan', 'Preeti',
  'Gaurav', 'Payal', 'Harsh', 'Swati', 'Alok', 'Pallavi', 'Nikhil', 'Simran'
]

const LAST_NAMES = [
  'Sharma', 'Patel', 'Verma', 'Rao', 'Malhotra', 'Kulkarni', 'Reddy', 'Nair',
  'Iyer', 'Mehta', 'Gupta', 'Singh', 'Deshmukh', 'Joshi', 'Bose', 'Chopra',
  'Kapoor', 'Menon', 'Bhat', 'Agarwal'
]

const CITIES = [
  'Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune',
  'Ahmedabad', 'Jaipur', 'Surat', 'Lucknow', 'Chandigarh', 'Indore', 'Kochi'
]

const MERCHANTS = [
  { name: 'Amazon India', category: 'E-Commerce' },
  { name: 'Flipkart', category: 'E-Commerce' },
  { name: 'Swiggy', category: 'Food & Dining' },
  { name: 'Zomato', category: 'Food & Dining' },
  { name: 'Reliance Digital', category: 'Electronics' },
  { name: 'Croma', category: 'Electronics' },
  { name: 'Myntra', category: 'Fashion' },
  { name: 'Tata CliQ', category: 'Luxury' },
  { name: 'MakeMyTrip', category: 'Travel' },
  { name: 'BookMyShow', category: 'Entertainment' },
  { name: 'Blinkit', category: 'Groceries' },
  { name: 'Zepto', category: 'Groceries' },
  { name: 'Uber India', category: 'Transportation' },
  { name: 'IRCTC', category: 'Travel' },
  { name: 'Apollo Pharmacy', category: 'Healthcare' },
  { name: 'CryptoHub India', category: 'Crypto / High Risk' },
]

const FACTOR_TEMPLATES = [
  { feature: 'V14', desc: 'PCA feature V14 deviated significantly from user centroid', impactRange: [0.25, 0.45] },
  { feature: 'Amount', desc: 'Transaction INR amount exceeds 3x moving average for card', impactRange: [0.15, 0.35] },
  { feature: 'Time', desc: 'Velocity burst: 4th high-value transaction in 12 minutes', impactRange: [0.18, 0.38] },
  { feature: 'V10', desc: 'Device fingerprint variance indicated spoofed browser user-agent', impactRange: [0.12, 0.30] },
  { feature: 'V12', desc: 'Foreign or proxy IP routing detected outside registered city', impactRange: [0.20, 0.42] },
  { feature: 'V4', desc: 'Merchant MCC high-risk categorization for non-standard purchase', impactRange: [0.10, 0.28] },
  { feature: 'V17', desc: 'Rapid geographical jump from previous transaction pin-code', impactRange: [0.22, 0.48] },
  { feature: 'V11', desc: 'Off-hours transaction timing between 2:00 AM and 4:30 AM', impactRange: [0.08, 0.22] },
]

// Generate 40 Users across 4 roles
export function generateUsers() {
  const users = [
    {
      id: 'usr_admin_1',
      name: 'Aarav Sharma',
      email: 'admin@fraudshield.io',
      role: 'admin',
      status: 'active',
      department: 'Risk Operations',
      city: 'Mumbai',
      phone: '+91 98765 43210',
      lastLogin: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    },
    {
      id: 'usr_analyst_1',
      name: 'Priya Patel',
      email: 'analyst@fraudshield.io',
      role: 'analyst',
      status: 'active',
      department: 'Fraud Investigation',
      city: 'Bengaluru',
      phone: '+91 98111 22334',
      lastLogin: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    },
    {
      id: 'usr_customer_1',
      name: 'Rohan Verma',
      email: 'customer@fraudshield.io',
      role: 'customer',
      status: 'active',
      department: 'Retail Banking',
      city: 'Delhi',
      phone: '+91 99887 76655',
      lastLogin: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    },
    {
      id: 'usr_merchant_1',
      name: 'Ananya Rao',
      email: 'merchant@fraudshield.io',
      role: 'merchant',
      status: 'active',
      department: 'SpiceMart Retail',
      city: 'Hyderabad',
      phone: '+91 97654 32109',
      lastLogin: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    },
  ]

  const roles = ['admin', 'analyst', 'customer', 'merchant']
  for (let i = 4; i < 40; i++) {
    const fName = FIRST_NAMES[i % FIRST_NAMES.length]
    const lName = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)]
    const role = roles[i % roles.length]
    const city = CITIES[Math.floor(rng() * CITIES.length)]
    users.push({
      id: `usr_${role}_${i + 1}`,
      name: `${fName} ${lName}`,
      email: `${fName.toLowerCase()}.${lName.toLowerCase()}${i}@fraudshield.io`,
      role,
      status: rng() > 0.08 ? 'active' : 'suspended',
      department: role === 'admin' ? 'Security & Compliance' : role === 'analyst' ? 'Level 2 Ops' : role === 'merchant' ? 'Partner Commerce' : 'Standard Account',
      city,
      phone: `+91 ${90000 + Math.floor(rng() * 9999)} ${10000 + Math.floor(rng() * 89999)}`,
      lastLogin: new Date(Date.now() - Math.floor(rng() * 14 * 86400000)).toISOString(),
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${fName}${lName}`,
    })
  }

  return users
}

// Generate 60 Cards
export function generateCards(users) {
  const cards = []
  const cardTypes = ['Visa Platinum', 'Mastercard World', 'RuPay Select', 'Visa Signature']
  for (let i = 1; i <= 60; i++) {
    const user = users[i % users.length]
    const last4 = 1000 + Math.floor(rng() * 8999)
    const cardType = cardTypes[Math.floor(rng() * cardTypes.length)]
    const expMonth = String(1 + Math.floor(rng() * 12)).padStart(2, '0')
    const expYear = 26 + Math.floor(rng() * 5)
    cards.push({
      id: `crd_${i}`,
      cardNumber: `•••• •••• •••• ${last4}`,
      cardHolder: user.name,
      userId: user.id,
      expiry: `${expMonth}/${expYear}`,
      cardType,
      status: rng() > 0.1 ? 'active' : rng() > 0.5 ? 'flagged' : 'blocked',
      limitINR: [50000, 100000, 250000, 500000, 1000000][Math.floor(rng() * 5)],
      bank: ['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra'][Math.floor(rng() * 5)],
    })
  }
  return cards
}

// Generate 400 Transactions with ~3% >= 0.89, ~5% between 0.5 and 0.89, rest < 0.5
export function generateTransactions(users, cards) {
  const transactions = []
  const now = Date.now()

  for (let i = 1; i <= 400; i++) {
    const user = users[i % users.length]
    const card = cards[i % cards.length]
    const merchantObj = MERCHANTS[Math.floor(rng() * MERCHANTS.length)]
    const city = CITIES[Math.floor(rng() * CITIES.length)]
    
    // Exact distribution:
    // ~3% (12 txns) >= 0.89 (High risk / Blocked)
    // ~5% (20 txns) between 0.5 and 0.89 (Review / Under Review)
    // rest (368 txns, ~92%) < 0.5 (Safe / Approved)
    let riskScore
    let trueLabel
    let band
    let status

    if (i <= 12) {
      // High Risk / FRAUD (>= 0.89)
      riskScore = Number((0.89 + rng() * 0.09).toFixed(3))
      trueLabel = 'FRAUD'
      band = 'high'
      status = 'Blocked'
    } else if (i <= 32) {
      // Review / SUSPICIOUS (0.50 - 0.889)
      riskScore = Number((0.50 + rng() * 0.38).toFixed(3))
      trueLabel = 'SUSPICIOUS'
      band = 'review'
      status = 'Under Review'
    } else {
      // Safe / LEGIT (< 0.50)
      riskScore = Number((0.01 + rng() * 0.47).toFixed(3))
      trueLabel = 'LEGIT'
      band = 'safe'
      status = 'Approved'
    }

    const amountINR = trueLabel === 'FRAUD'
      ? Math.floor(15000 + rng() * 85000)
      : trueLabel === 'SUSPICIOUS'
      ? Math.floor(4500 + rng() * 25000)
      : Math.floor(250 + rng() * 6500)

    // Generate 5 explanation factors
    const shuffledFactors = [...FACTOR_TEMPLATES].sort(() => rng() - 0.5)
    const explanationFactors = shuffledFactors.slice(0, 5).map(f => {
      const isPositive = trueLabel === 'FRAUD' ? rng() > 0.15 : trueLabel === 'SUSPICIOUS' ? rng() > 0.4 : rng() > 0.75
      const magnitude = Number((f.impactRange[0] + rng() * (f.impactRange[1] - f.impactRange[0])).toFixed(3))
      return {
        feature: f.feature,
        impact: isPositive ? magnitude : -magnitude,
        description: f.desc,
        direction: isPositive ? 'risk_increasing' : 'risk_decreasing',
      }
    })

    // Model Inputs: Time, Amount, V1-V28
    const modelInputs = {
      Time: Math.floor(i * 420 + rng() * 100),
      Amount: amountINR,
    }
    for (let v = 1; v <= 28; v++) {
      const vVal = trueLabel === 'FRAUD' && [14, 10, 12, 17, 4].includes(v)
        ? Number((-4.5 + rng() * 8.0).toFixed(4))
        : Number((-2.0 + rng() * 4.0).toFixed(4))
      modelInputs[`V${v}`] = vVal
    }

    const timestamp = new Date(now - Math.floor(rng() * 30 * 86400000) - i * 180000).toISOString()

    transactions.push({
      id: `TXN-${String(100000 + i)}`,
      transactionId: `TXN-${String(100000 + i)}`,
      userId: user.id,
      customerName: user.name,
      customerEmail: user.email,
      cardId: card.id,
      cardNumber: card.cardNumber,
      cardType: card.cardType,
      merchant: merchantObj.name,
      merchantCategory: merchantObj.category,
      city,
      amountINR,
      amount: amountINR,
      currency: 'INR',
      timestamp,
      riskScore,
      band,
      trueLabel,
      explanationFactors,
      modelInputs,
      status,
      channel: ['POS', 'Online', 'UPI', 'ATM'][Math.floor(rng() * 4)],
    })
  }

  // Sort descending by timestamp
  return transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
}

// Generate Alerts from transactions at or above 0.50
export function generateAlerts(transactions) {
  const alerts = []
  const highRiskTxns = transactions.filter(t => t.riskScore >= 0.50)

  highRiskTxns.forEach((txn, idx) => {
    const isCritical = txn.riskScore >= 0.89
    const isHigh = txn.riskScore >= 0.70
    alerts.push({
      id: `ALT-${String(1000 + idx + 1)}`,
      alertId: `ALT-${String(1000 + idx + 1)}`,
      transactionId: txn.id,
      customerName: txn.customerName,
      amountINR: txn.amountINR,
      merchant: txn.merchant,
      riskScore: txn.riskScore,
      severity: isCritical ? 'critical' : isHigh ? 'high' : 'medium',
      status: idx < 12 ? 'new' : idx < 24 ? 'investigating' : 'resolved',
      ruleTriggered: txn.explanationFactors[0]?.description || 'Anomalous velocity threshold exceeded',
      timestamp: txn.timestamp,
    })
  })

  return alerts
}

// Generate 25 Cases with Notes and Timelines
export function generateCases(transactions, users) {
  const cases = []
  const analysts = users.filter(u => u.role === 'analyst')
  const flaggedTxns = transactions.filter(t => t.riskScore >= 0.50).slice(0, 25)

  flaggedTxns.forEach((txn, idx) => {
    const analyst = analysts[idx % analysts.length]
    const status = idx < 6 ? 'Open' : idx < 15 ? 'In Review' : idx < 20 ? 'Escalated' : 'Closed'
    const priority = txn.riskScore > 0.8 ? 'P1' : txn.riskScore > 0.65 ? 'P2' : 'P3'
    const createdAt = txn.timestamp

    const notes = [
      {
        id: `note_${idx}_1`,
        author: 'System Auto-Monitor',
        timestamp: new Date(new Date(createdAt).getTime() + 60000).toISOString(),
        text: `Automated case created. Risk score ${Math.round(txn.riskScore * 100)}% triggered alert ALT-${1000 + idx + 1}.`,
      },
      {
        id: `note_${idx}_2`,
        author: analyst.name,
        timestamp: new Date(new Date(createdAt).getTime() + 600000).toISOString(),
        text: `Contacted customer via registered SMS. Awaiting cardholder confirmation for ₹${txn.amountINR.toLocaleString('en-IN')}.`,
      },
    ]

    const timeline = [
      {
        id: `tl_${idx}_1`,
        timestamp: createdAt,
        action: 'Case Created',
        user: 'System Monitor',
        note: `Flagged from transaction ${txn.id}`,
      },
      {
        id: `tl_${idx}_2`,
        timestamp: new Date(new Date(createdAt).getTime() + 300000).toISOString(),
        action: 'Assigned to Analyst',
        user: analyst.name,
        note: `Assigned priority ${priority}`,
      },
    ]

    if (status === 'Closed') {
      timeline.push({
        id: `tl_${idx}_3`,
        timestamp: new Date(new Date(createdAt).getTime() + 7200000).toISOString(),
        action: 'Case Resolved',
        user: analyst.name,
        note: 'Customer confirmed unauthorized usage; card blocked & chargeback initiated.',
      })
    }

    cases.push({
      id: `CAS-${String(5000 + idx + 1)}`,
      caseId: `CAS-${String(5000 + idx + 1)}`,
      transactionId: txn.id,
      analystId: analyst.id,
      analystName: analyst.name,
      customerName: txn.customerName,
      customerEmail: txn.customerEmail,
      amountINR: txn.amountINR,
      merchant: txn.merchant,
      riskScore: txn.riskScore,
      priority,
      status,
      createdAt,
      updatedAt: new Date(new Date(createdAt).getTime() + 3600000).toISOString(),
      notes,
      timeline,
    })
  })

  return cases
}

// Generate 20 Disputes
export function generateDisputes(transactions) {
  const disputes = []
  const txns = transactions.slice(10, 30)

  const reasons = [
    'Card was in my possession, did not authorize transaction',
    'Charged twice for the same purchase',
    'Merchant did not deliver goods / service canceled',
    'Incorrect amount charged at checkout terminal',
    'Suspected ATM skimmer fraudulent withdrawal',
  ]

  txns.forEach((txn, idx) => {
    const status = idx < 5 ? 'Submitted' : idx < 12 ? 'Under Review' : idx < 17 ? 'Resolved' : 'Rejected'
    disputes.push({
      id: `DSP-${String(8000 + idx + 1)}`,
      disputeId: `DSP-${String(8000 + idx + 1)}`,
      transactionId: txn.id,
      customerId: txn.userId,
      customerName: txn.customerName,
      customerEmail: txn.customerEmail,
      merchant: txn.merchant,
      amountINR: txn.amountINR,
      reason: reasons[idx % reasons.length],
      status,
      filedAt: txn.timestamp,
      evidenceNotes: 'Attached bank statement and merchant correspondence invoice.',
    })
  })

  return disputes
}

// Generate 80 Audit Logs
export function generateAuditLogs(users) {
  const logs = []
  const now = Date.now()
  const actions = [
    { action: 'USER_LOGIN', target: 'AuthPortal' },
    { action: 'CARD_BLOCKED', target: 'CardService' },
    { action: 'RULE_UPDATED', target: 'RiskEngine' },
    { action: 'TRANSACTION_OVERRIDE', target: 'TxnController' },
    { action: 'DISPUTE_FILED', target: 'DisputeDesk' },
    { action: 'MODEL_RETRAIN_TRIGGERED', target: 'MLPipeline' },
    { action: 'USER_ROLE_CHANGED', target: 'UserManagement' },
    { action: 'EXPORT_CSV_DOWNLOADED', target: 'AnalystDashboard' },
  ]

  for (let i = 1; i <= 80; i++) {
    const user = users[i % users.length]
    const act = actions[i % actions.length]
    logs.push({
      id: `LOG-${String(90000 + i)}`,
      timestamp: new Date(now - i * 3600000 * 2.5).toISOString(),
      actor: user.name,
      actorRole: user.role,
      action: act.action,
      target: act.target,
      ipAddress: `103.${40 + (i % 80)}.${10 + (i % 200)}.${i % 250}`,
      status: i % 15 === 0 ? 'FAILURE' : 'SUCCESS',
      details: `Action ${act.action} executed against ${act.target} by ${user.role}.`,
    })
  }

  return logs
}

// Generate 15 Notifications
export function generateNotifications() {
  return [
    { id: 'ntf_1', timestamp: new Date(Date.now() - 300000).toISOString(), title: 'High Risk Alert Triggered', message: 'Transaction TXN-100002 scored 94% risk at CryptoHub India (₹82,400)', type: 'alert', read: false, link: '/analyst/investigate' },
    { id: 'ntf_2', timestamp: new Date(Date.now() - 1200000).toISOString(), title: 'New Dispute Assigned', message: 'Customer Rohan Verma opened dispute DSP-8001 for ₹34,500', type: 'case', read: false, link: '/customer/dispute' },
    { id: 'ntf_3', timestamp: new Date(Date.now() - 3600000).toISOString(), title: 'Batch Scoring Complete', message: 'Batch of 1,250 records evaluated successfully. 42 flags identified.', type: 'system', read: false, link: '/analyst/batch' },
    { id: 'ntf_4', timestamp: new Date(Date.now() - 7200000).toISOString(), title: 'Model Checkpoint Saved', message: 'XGBoost v2.4.1 pipeline checkpoint verified on validation set.', type: 'system', read: true, link: '/analyst/model' },
    { id: 'ntf_5', timestamp: new Date(Date.now() - 14400000).toISOString(), title: 'Card Auto-Suspended', message: 'Card ending in 4821 blocked due to 3 anomalous location spikes.', type: 'alert', read: true, link: '/admin/dashboard' },
    { id: 'ntf_6', timestamp: new Date(Date.now() - 28800000).toISOString(), title: 'Chargeback Won', message: 'Chargeback inquiry DSP-8012 closed in merchant favor (₹12,400).', type: 'case', read: true, link: '/merchant/chargebacks' },
    { id: 'ntf_7', timestamp: new Date(Date.now() - 43200000).toISOString(), title: 'Suspicious IP Anomaly', message: 'Burst traffic detected from Tor exit node 185.220.101.4', type: 'alert', read: true, link: '/analyst/investigate' },
    { id: 'ntf_8', timestamp: new Date(Date.now() - 86400000).toISOString(), title: 'Weekly Risk Digest', message: 'Weekly fraud rate decreased by 0.32% compared to previous period.', type: 'system', read: true, link: '/admin/dashboard' },
    { id: 'ntf_9', timestamp: new Date(Date.now() - 95000000).toISOString(), title: 'Retraining Scheduled', message: 'Automated retraining trigger queued for Sunday 02:00 IST.', type: 'system', read: true, link: '/analyst/model' },
    { id: 'ntf_10', timestamp: new Date(Date.now() - 120000000).toISOString(), title: 'Admin Permissions Modified', message: 'User Aarav Sharma granted audit oversight roles.', type: 'system', read: true, link: '/admin/users' },
    { id: 'ntf_11', timestamp: new Date(Date.now() - 150000000).toISOString(), title: 'API Gateway Latency Alert', message: 'Predict endpoint latency spike resolved (142ms -> 24ms).', type: 'alert', read: true, link: '/admin/config' },
    { id: 'ntf_12', timestamp: new Date(Date.now() - 180000000).toISOString(), title: 'Compliance Report Ready', message: 'RBI regulatory fraud reporting annexure generated for Q3.', type: 'case', read: true, link: '/analyst/dashboard' },
    { id: 'ntf_13', timestamp: new Date(Date.now() - 210000000).toISOString(), title: 'Customer Contact Verified', message: 'Customer phone OTP authenticated for case CAS-5004.', type: 'case', read: true, link: '/analyst/investigate' },
    { id: 'ntf_14', timestamp: new Date(Date.now() - 240000000).toISOString(), title: 'Threshold Modified', message: 'Fraud cutoff updated to 0.89 by Admin.', type: 'system', read: true, link: '/admin/config' },
    { id: 'ntf_15', timestamp: new Date(Date.now() - 270000000).toISOString(), title: 'Platform Health Optimal', message: 'All 6 microservices reporting nominal latency and 0 unhandled faults.', type: 'system', read: true, link: '/admin/dashboard' },
  ]
}

// ModelInfo with TODO comment as requested
// TODO: replace placeholder metrics with the real Colab results
export const MODEL_INFO = {
  version: 'xgb-fraud-v2.4.1',
  algorithm: 'XGBoost Classifier with SMOTE & Focal Loss',
  threshold: 0.89,
  trainedDate: '2026-09-28T14:30:00Z',
  datasetSize: '284,807 Kaggle Transactions (Indianized INR scale)',
  featuresCount: 30,
  metrics: {
    accuracy: 0.9994,
    precision: 0.892,
    recall: 0.854,
    f1Score: 0.873,
    rocAuc: 0.982,
    prAuc: 0.886,
    avgLatencyMs: 18.4,
  },
  confusionMatrix: {
    truePositive: 420,
    falsePositive: 51,
    trueNegative: 284264,
    falseNegative: 72,
  },
  prCurvePoints: [
    { recall: 0.0, precision: 1.0 },
    { recall: 0.2, precision: 0.98 },
    { recall: 0.4, precision: 0.95 },
    { recall: 0.6, precision: 0.92 },
    { recall: 0.8, precision: 0.87 },
    { recall: 0.85, precision: 0.82 },
    { recall: 0.9, precision: 0.74 },
    { recall: 0.95, precision: 0.58 },
    { recall: 1.0, precision: 0.22 },
  ],
  rocCurvePoints: [
    { fpr: 0.000, tpr: 0.00 },
    { fpr: 0.001, tpr: 0.70 },
    { fpr: 0.002, tpr: 0.82 },
    { fpr: 0.005, tpr: 0.89 },
    { fpr: 0.010, tpr: 0.94 },
    { fpr: 0.020, tpr: 0.97 },
    { fpr: 0.050, tpr: 0.99 },
    { fpr: 0.100, tpr: 1.00 },
    { fpr: 1.000, tpr: 1.00 },
  ],
  top10FeatureImportance: [
    { feature: 'V14', importance: 0.245, description: 'Negative correlation with fraud cluster centroid' },
    { feature: 'V10', importance: 0.182, description: 'Behavioral sequence pattern deviation' },
    { feature: 'V12', importance: 0.154, description: 'Account velocity anomaly factor' },
    { feature: 'V17', importance: 0.118, description: 'Spatial transaction dispersion' },
    { feature: 'V4', importance: 0.091, description: 'High-risk channel correlation' },
    { feature: 'V11', importance: 0.065, description: 'Terminal authentication deviation' },
    { feature: 'Amount', importance: 0.048, description: 'Log-normalized INR transaction amount' },
    { feature: 'V2', importance: 0.035, description: 'User demographic baseline divergence' },
    { feature: 'V27', importance: 0.024, description: 'Session latency signature' },
    { feature: 'Time', importance: 0.019, description: 'Time delta from midnight cyclic wave' },
  ],
  comparisonTable: [
    {
      model: 'Logistic Regression',
      accuracy: '99.89%',
      precision: '0.642',
      recall: '0.710',
      f1Score: '0.674',
      rocAuc: '0.942',
      latency: '2.1 ms',
    },
    {
      model: 'Random Forest',
      accuracy: '99.92%',
      precision: '0.841',
      recall: '0.812',
      f1Score: '0.826',
      rocAuc: '0.965',
      latency: '34.2 ms',
    },
    {
      model: 'XGBoost (Active)',
      accuracy: '99.94%',
      precision: '0.892',
      recall: '0.854',
      f1Score: '0.873',
      rocAuc: '0.982',
      latency: '18.4 ms',
    },
  ],
}
