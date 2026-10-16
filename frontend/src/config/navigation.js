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
  Radio,
  FileText,
  Zap,
  Terminal,
  FileCheck2,
} from 'lucide-react'
import { ROLES } from './constants.js'

export const NAVIGATION_ITEMS = {
  [ROLES.ADMIN]: [
    { label: 'Admin Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'User Management', path: '/admin/users', icon: Users },
    { label: 'System Config', path: '/admin/config', icon: Sliders },
    { label: 'Audit Trail', path: '/audit-logs', icon: Terminal },
    { label: 'Inference Lab', path: '/checker', icon: Zap },
  ],
  [ROLES.ANALYST]: [
    { label: 'Analyst Dashboard', path: '/analyst/dashboard', icon: Activity },
    { label: 'Investigate', path: '/analyst/investigate', icon: Search },
    { label: 'Live Stream', path: '/analyst/live', icon: Radio },
    { label: 'Batch Scoring', path: '/analyst/batch', icon: UploadCloud },
    { label: 'Model Diagnostics', path: '/analyst/model', icon: Cpu },
    { label: 'Intelligence Reports', path: '/analyst/reports', icon: FileText },
    { label: 'Inference Lab', path: '/checker', icon: Zap },
  ],
  [ROLES.CUSTOMER]: [
    { label: 'Cards & Overview', path: '/customer/overview', icon: CreditCard },
    { label: 'My Transactions', path: '/customer/transactions', icon: Receipt },
    { label: 'Security Alerts', path: '/customer/alerts', icon: ShieldAlert },
    { label: 'Dispute Center', path: '/customer/dispute', icon: Layers },
  ],
  [ROLES.MERCHANT]: [
    { label: 'Store Overview', path: '/merchant/overview', icon: BarChart3 },
    { label: 'Chargeback Desk', path: '/merchant/chargebacks', icon: Receipt },
    { label: 'Settlement Reports', path: '/merchant/reports', icon: FileCheck2 },
  ],
}

