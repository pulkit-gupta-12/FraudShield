import React, { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar.jsx'
import { Topbar } from './Topbar.jsx'

const ROUTE_TITLES = {
  '/': 'FraudShield — AI-Powered Credit Card Fraud Detection',
  '/login': 'Sign In — FraudShield',
  '/register': 'Create Account — FraudShield',
  '/profile': 'Profile & Security — FraudShield',
  '/403': 'Access Denied — FraudShield',
  '/unauthorized': 'Access Denied — FraudShield',
  '/404': 'Page Not Found — FraudShield',
  '/admin/dashboard': 'Admin Dashboard — FraudShield',
  '/admin/users': 'User Management & RBAC — FraudShield',
  '/admin/config': 'System Config & Thresholds — FraudShield',
  '/analyst/dashboard': 'Analyst Dashboard — FraudShield',
  '/analyst/investigate': 'Investigation Triage — FraudShield',
  '/analyst/live': 'Live Transaction Stream — FraudShield',
  '/analyst/batch': 'Batch CSV Scoring — FraudShield',
  '/analyst/model': 'Model Diagnostics & Thresholds — FraudShield',
  '/analyst/reports': 'Compliance & Audit Reports — FraudShield',
  '/customer/overview': 'Cards & Financial Overview — FraudShield',
  '/customer/cards': 'Cards & Financial Overview — FraudShield',
  '/customer/transactions': 'My Transactions — FraudShield',
  '/customer/alerts': 'Security Alerts — FraudShield',
  '/customer/dispute': 'Dispute Center — FraudShield',
  '/merchant/overview': 'Merchant Risk Overview — FraudShield',
  '/merchant/chargebacks': 'Chargeback Defense Desk — FraudShield',
  '/merchant/reports': 'Merchant Settlement Reports — FraudShield',
  '/checker': 'Transaction Checker & ML Lab — FraudShield',
  '/notifications': 'Security Notifications — FraudShield',
  '/audit-logs': 'System Audit Logs — FraudShield',
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const path = location.pathname
    if (path.startsWith('/analyst/cases/')) {
      document.title = 'Case Detail & Inspector — FraudShield'
    } else {
      document.title = ROUTE_TITLES[path] || 'FraudShield — AI-Powered Fraud Detection'
    }
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      {/* Sidebar (Desktop and Mobile Drawer) */}
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <div key={location.pathname} className="page-transition">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

