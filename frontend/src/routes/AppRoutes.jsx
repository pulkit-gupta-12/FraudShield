import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { PublicLayout } from '../components/layout/PublicLayout.jsx'
import { AppShell } from '../components/layout/AppShell.jsx'
import { ProtectedRoute } from './ProtectedRoute.jsx'
import { RoleRoute } from './RoleRoute.jsx'

// Public Pages
import { LandingPage } from '../pages/public/LandingPage.jsx'
import { LoginPage } from '../pages/public/LoginPage.jsx'
import { RegisterPage } from '../pages/public/RegisterPage.jsx'

// Common Pages
import { ProfilePage } from '../pages/common/ProfilePage.jsx'
import { UnauthorizedPage } from '../pages/common/UnauthorizedPage.jsx'
import { NotFoundPage } from '../pages/common/NotFoundPage.jsx'
import { UiKitPage } from '../pages/common/UiKitPage.jsx'
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

export function AppRoutes() {
  return (
    <Routes>
      {/* Public Pages */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/ui-kit" element={<UiKitPage />} />
        <Route path="/403" element={<UnauthorizedPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="/404" element={<NotFoundPage />} />
      </Route>

      {/* Authenticated Protected Pages within AppShell */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          {/* Common Authenticated */}
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/notifications" element={<NotificationsPage />} />

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

          {/* Analyst Routes */}
          <Route element={<RoleRoute allowedRoles={['analyst']} />}>
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

          {/* Customer Routes */}
          <Route element={<RoleRoute allowedRoles={['customer']} />}>
            <Route path="/customer" element={<Navigate to="/customer/overview" replace />} />
            <Route path="/customer/pay" element={<UseMyCardPage />} />
            <Route path="/customer/overview" element={<CustomerOverviewPage />} />
            <Route path="/customer/cards" element={<CustomerOverviewPage />} />
            <Route path="/customer/transactions" element={<MyTransactionsPage />} />
            <Route path="/customer/alerts" element={<CustomerAlertsPage />} />
            <Route path="/customer/dispute" element={<DisputePage />} />
          </Route>

          {/* Merchant Routes */}
          <Route element={<RoleRoute allowedRoles={['merchant', 'admin']} />}>
            <Route path="/merchant" element={<Navigate to="/merchant/overview" replace />} />
            <Route path="/merchant/terminal" element={<MerchantTerminalPage />} />
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
