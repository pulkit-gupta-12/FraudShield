export const ROLES = {
  ADMIN: 'admin',
  ANALYST: 'analyst',
  CUSTOMER: 'customer',
  MERCHANT: 'merchant',
}

export const RISK_LEVELS = {
  LEGIT: 'LEGIT',
  SUSPICIOUS: 'SUSPICIOUS',
  FRAUD: 'FRAUD',
}

export const RISK_THRESHOLDS = {
  SUSPICIOUS: 0.40,
  FRAUD: 0.70,
}

export const DEMO_ACCOUNTS = [
  {
    id: 'usr_admin_1',
    email: 'admin@fraudshield.io',
    password: 'password123',
    name: 'Aarav Sharma',
    role: ROLES.ADMIN,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    department: 'Risk Operations',
    phone: '+91 98765 43210',
    city: 'Mumbai',
  },
  {
    id: 'usr_analyst_1',
    email: 'analyst@fraudshield.io',
    password: 'password123',
    name: 'Priya Patel',
    role: ROLES.ANALYST,
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    department: 'Fraud Investigation',
    phone: '+91 98111 22334',
    city: 'Bengaluru',
  },
  {
    id: 'usr_customer_1',
    email: 'customer@fraudshield.io',
    password: 'password123',
    name: 'Rohan Verma',
    role: ROLES.CUSTOMER,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    department: 'Retail Banking',
    phone: '+91 99887 76655',
    city: 'Delhi',
  },
  {
    id: 'usr_merchant_1',
    email: 'merchant@fraudshield.io',
    password: 'password123',
    name: 'Ananya Rao',
    role: ROLES.MERCHANT,
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    department: 'SpiceMart Retail',
    phone: '+91 97654 32109',
    city: 'Hyderabad',
  },
]
