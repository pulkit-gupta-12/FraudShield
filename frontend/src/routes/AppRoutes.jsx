import React from 'react'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { PublicLayout } from '../components/layout/PublicLayout.jsx'
import { AppShell } from '../components/layout/AppShell.jsx'
import { ProtectedRoute } from './ProtectedRoute.jsx'
import { RoleRoute } from './RoleRoute.jsx'
import { useAuth, getRoleDashboardPath } from '../context/AuthContext.jsx'

// Public Pages
import { LandingPage } from '../pages/public/LandingPage.jsx'
import { LoginPage } from '../pages/public/LoginPage.jsx'
import { RegisterPage } from '../pages/public/RegisterPage.jsx'

// Common Pages
import { ProfilePage } from '../pages/common/ProfilePage.jsx'
import { UnauthorizedPage } from '../pages/common/UnauthorizedPage.jsx'
import { NotFoundPage } from '../pages/common/NotFoundPage.jsx'
import { TransactionCheckerPage } from '../pages/common/TransactionCheckerPage.jsx'
import { NotificationsPage } from '../pages/common/NotificationsPage.jsx'
import { AuditLogsPage } from '../pages/common/AuditLogsPage.jsx'

// Admin Pages
import { AdminDashboard } from '../pages/admin/AdminDashboard.jsx'
import { AdminUsers } from '../pages/admin/AdminUsers.jsx'
import { AdminConfig } from '../pages/admin/AdminConfig.jsx'
import { AdminMerchants } from '../pages/admin/AdminMerchants.jsx'
import { AdminPatterns } from '../pages/admin/AdminPatterns.jsx'

// Analyst Pages
import { AnalystDashboard } from '../pages/analyst/AnalystDashboard.jsx'
import { InvestigatePage } from '../pages/analyst/InvestigatePage.jsx'
import { BatchUploadPage } from '../pages/analyst/BatchUploadPage.jsx'
import { ModelPanelPage } from '../pages/analyst/ModelPanelPage.jsx'
import { LiveFeedPage } from '../pages/analyst/LiveFeedPage.jsx'
import { CaseDetailPage } from '../pages/analyst/CaseDetailPage.jsx'
import { ReportsPage } from '../pages/analyst/ReportsPage.jsx'

// Customer Pages
import { CustomerOverviewPage } from '../pages/customer/CustomerOverviewPage.jsx'
import { MyTransactionsPage } from '../pages/customer/MyTransactionsPage.jsx'
import { CustomerAlertsPage } from '../pages/customer/CustomerAlertsPage.jsx'
import { DisputePage } from '../pages/customer/DisputePage.jsx'
import { UseMyCardPage } from '../pages/customer/UseMyCardPage.jsx'

// Merchant Pages
import { MerchantOverviewPage } from '../pages/merchant/MerchantOverviewPage.jsx'
import { MerchantChargebacksPage } from '../pages/merchant/MerchantChargebacksPage.jsx'
import { MerchantReportsPage } from '../pages/merchant/MerchantReportsPage.jsx'
import { MerchantTerminalPage } from '../pages/merchant/MerchantTerminalPage.jsx'

// Dynamic Route Resolvers for Shorthand & Notification Links
function DashboardRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={getRoleDashboardPath(user.role)} replace />
}

function TransactionsRedirect() {
  const { user } = useAuth()
  const { id } = useParams()
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'customer') {
    return <Navigate to={id ? `/customer/transactions?search=${id}` : '/customer/transactions'} replace />
  }
  if (user.role === 'merchant') {
    return <Navigate to={id ? `/merchant/chargebacks?search=${id}` : '/merchant/overview'} replace />
  }
  return <Navigate to={id ? `/analyst/investigate?search=${id}` : '/analyst/investigate'} replace />
}

function AlertsRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'customer') return <Navigate to="/customer/alerts" replace />
  return <Navigate to="/analyst/investigate" replace />
}

function CasesRedirect() {
  const { user } = useAuth()
  const { id } = useParams()
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'customer') return <Navigate to="/customer/alerts" replace />
  if (user.role === 'merchant') return <Navigate to="/merchant/chargebacks" replace />
  return <Navigate to={id ? `/analyst/cases/${id}` : '/analyst/investigate'} replace />
}

function DisputesRedirect() {
  const { user } = useAuth()
  const { id } = useParams()
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'merchant') return <Navigate to="/merchant/chargebacks" replace />
  if (user.role === 'customer') return <Navigate to="/customer/dispute" replace />
  return <Navigate to={id ? `/analyst/cases/${id}` : '/analyst/investigate'} replace />
}

function CardsRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'customer') return <Navigate to="/customer/overview" replace />
  return <Navigate to="/admin/users" replace />
}

function ReportsRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'merchant') return <Navigate to="/merchant/reports" replace />
  return <Navigate to="/analyst/reports" replace />
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Public Pages */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/403" element={<UnauthorizedPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="/404" element={<NotFoundPage />} />
      </Route>

      {/* Authenticated Protected Pages within AppShell */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          {/* Universal Dashboard Redirect */}
          <Route path="/dashboard" element={<DashboardRedirect />} />

          {/* Common Authenticated */}
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/notifications" element={<NotificationsPage />} />

          {/* Shorthand & Notification Link Resolvers */}
          <Route path="/transactions" element={<TransactionsRedirect />} />
          <Route path="/transactions/:id" element={<TransactionsRedirect />} />
          <Route path="/alerts" element={<AlertsRedirect />} />
          <Route path="/alerts/:id" element={<AlertsRedirect />} />
          <Route path="/cases" element={<CasesRedirect />} />
          <Route path="/cases/:id" element={<CasesRedirect />} />
          <Route path="/disputes" element={<DisputesRedirect />} />
          <Route path="/disputes/:id" element={<DisputesRedirect />} />
          <Route path="/cards" element={<CardsRedirect />} />
          <Route path="/reports" element={<ReportsRedirect />} />
          <Route path="/users" element={<Navigate to="/admin/users" replace />} />
          <Route path="/merchants" element={<Navigate to="/admin/merchants" replace />} />
          <Route path="/patterns" element={<Navigate to="/admin/patterns" replace />} />
          <Route path="/config" element={<Navigate to="/admin/config" replace />} />
          <Route path="/governance" element={<Navigate to="/admin/config" replace />} />
          <Route path="/admin/governance" element={<Navigate to="/admin/config" replace />} />
          <Route path="/investigate" element={<Navigate to="/analyst/investigate" replace />} />
          <Route path="/investigate/:id" element={<CasesRedirect />} />
          <Route path="/live" element={<Navigate to="/analyst/live" replace />} />
          <Route path="/batch" element={<Navigate to="/analyst/batch" replace />} />
          <Route path="/model" element={<Navigate to="/analyst/model" replace />} />
          <Route path="/terminal" element={<Navigate to="/merchant/terminal" replace />} />
          <Route path="/chargebacks" element={<Navigate to="/merchant/chargebacks" replace />} />
          <Route path="/pay" element={<Navigate to="/customer/pay" replace />} />
          <Route path="/dispute" element={<Navigate to="/customer/dispute" replace />} />

          {/* Internal Security & Ops Tools */}
          <Route element={<RoleRoute allowedRoles={['admin', 'analyst']} />}>
            <Route path="/audit-logs" element={<AuditLogsPage />} />
            <Route path="/checker" element={<TransactionCheckerPage />} />
          </Route>

          {/* Admin Routes */}
          <Route element={<RoleRoute allowedRoles={['admin']} />}>
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/merchants" element={<AdminMerchants />} />
            <Route path="/admin/patterns" element={<AdminPatterns />} />
            <Route path="/admin/config" element={<AdminConfig />} />
          </Route>

          {/* Analyst Routes (Also Accessible by Admin) */}
          <Route element={<RoleRoute allowedRoles={['analyst', 'admin']} />}>
            <Route path="/analyst" element={<Navigate to="/analyst/dashboard" replace />} />
            <Route path="/analyst/dashboard" element={<AnalystDashboard />} />
            <Route path="/analyst/investigate" element={<InvestigatePage />} />
            <Route path="/analyst/investigate/:id" element={<CaseDetailPage />} />
            <Route path="/analyst/cases/:id" element={<CaseDetailPage />} />
            <Route path="/analyst/live" element={<LiveFeedPage />} />
            <Route path="/analyst/batch" element={<BatchUploadPage />} />
            <Route path="/analyst/model" element={<ModelPanelPage />} />
            <Route path="/analyst/reports" element={<ReportsPage />} />
          </Route>

          {/* Customer Routes (Pay is also accessible by Admin/Analyst for testing) */}
          <Route element={<RoleRoute allowedRoles={['customer', 'admin', 'analyst']} />}>
            <Route path="/customer/pay" element={<UseMyCardPage />} />
          </Route>

          <Route element={<RoleRoute allowedRoles={['customer', 'admin']} />}>
            <Route path="/customer" element={<Navigate to="/customer/overview" replace />} />
            <Route path="/customer/overview" element={<CustomerOverviewPage />} />
            <Route path="/customer/cards" element={<CustomerOverviewPage />} />
            <Route path="/customer/transactions" element={<MyTransactionsPage />} />
            <Route path="/customer/alerts" element={<CustomerAlertsPage />} />
            <Route path="/customer/dispute" element={<DisputePage />} />
          </Route>

          {/* Merchant Routes (Terminal also accessible by Analyst for testing) */}
          <Route element={<RoleRoute allowedRoles={['merchant', 'admin', 'analyst']} />}>
            <Route path="/merchant/terminal" element={<MerchantTerminalPage />} />
          </Route>

          <Route element={<RoleRoute allowedRoles={['merchant', 'admin']} />}>
            <Route path="/merchant" element={<Navigate to="/merchant/overview" replace />} />
            <Route path="/merchant/overview" element={<MerchantOverviewPage />} />
            <Route path="/merchant/chargebacks" element={<MerchantChargebacksPage />} />
            <Route path="/merchant/reports" element={<MerchantReportsPage />} />
          </Route>
        </Route>
      </Route>

      {/* 404 Catch-All */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
