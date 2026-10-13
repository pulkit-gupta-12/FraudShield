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

// Admin Pages
import { AdminDashboard } from '../pages/admin/AdminDashboard.jsx'
import { AdminUsers } from '../pages/admin/AdminUsers.jsx'
import { AdminConfig } from '../pages/admin/AdminConfig.jsx'

// Analyst Pages
import { AnalystDashboard } from '../pages/analyst/AnalystDashboard.jsx'
import { InvestigatePage } from '../pages/analyst/InvestigatePage.jsx'
import { BatchUploadPage } from '../pages/analyst/BatchUploadPage.jsx'
import { ModelPanelPage } from '../pages/analyst/ModelPanelPage.jsx'

// Customer Pages
import { MyTransactionsPage } from '../pages/customer/MyTransactionsPage.jsx'
import { DisputePage } from '../pages/customer/DisputePage.jsx'

// Merchant Pages
import { MerchantOverviewPage } from '../pages/merchant/MerchantOverviewPage.jsx'
import { MerchantChargebacksPage } from '../pages/merchant/MerchantChargebacksPage.jsx'

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

          {/* Admin Routes */}
          <Route element={<RoleRoute allowedRoles={['admin']} />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/config" element={<AdminConfig />} />
          </Route>

          {/* Analyst Routes */}
          <Route element={<RoleRoute allowedRoles={['analyst']} />}>
            <Route path="/analyst/dashboard" element={<AnalystDashboard />} />
            <Route path="/analyst/investigate" element={<InvestigatePage />} />
            <Route path="/analyst/batch" element={<BatchUploadPage />} />
            <Route path="/analyst/model" element={<ModelPanelPage />} />
          </Route>

          {/* Customer Routes */}
          <Route element={<RoleRoute allowedRoles={['customer']} />}>
            <Route path="/customer/transactions" element={<MyTransactionsPage />} />
            <Route path="/customer/dispute" element={<DisputePage />} />
          </Route>

          {/* Merchant Routes */}
          <Route element={<RoleRoute allowedRoles={['merchant']} />}>
            <Route path="/merchant/overview" element={<MerchantOverviewPage />} />
            <Route path="/merchant/chargebacks" element={<MerchantChargebacksPage />} />
          </Route>
        </Route>
      </Route>

      {/* 404 Catch-All */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
