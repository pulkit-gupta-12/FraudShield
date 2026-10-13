import {
  LayoutDashboard,
  Users,
  Sliders,
  Activity,
  Search,
  UploadCloud,
  Cpu,
  CreditCard,
  ShieldAlert,
  BarChart3,
  Receipt,
  Layers,
} from 'lucide-react'
import { ROLES } from './constants.js'

export const NAVIGATION_ITEMS = {
  [ROLES.ADMIN]: [
    { label: 'Admin Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'User Management', path: '/admin/users', icon: Users },
    { label: 'System Config', path: '/admin/config', icon: Sliders },
  ],
  [ROLES.ANALYST]: [
    { label: 'Analyst Dashboard', path: '/analyst/dashboard', icon: Activity },
    { label: 'Investigate', path: '/analyst/investigate', icon: Search },
    { label: 'Batch Scoring', path: '/analyst/batch', icon: UploadCloud },
    { label: 'Model Diagnostics', path: '/analyst/model', icon: Cpu },
  ],
  [ROLES.CUSTOMER]: [
    { label: 'My Transactions', path: '/customer/transactions', icon: CreditCard },
    { label: 'Dispute Center', path: '/customer/dispute', icon: ShieldAlert },
  ],
  [ROLES.MERCHANT]: [
    { label: 'Store Overview', path: '/merchant/overview', icon: BarChart3 },
    { label: 'Chargeback Desk', path: '/merchant/chargebacks', icon: Receipt },
  ],
}
