import React from 'react'
import { Link } from 'react-router-dom'
import { ShieldX, ArrowLeft, Home } from 'lucide-react'
import { useAuth, getRoleDashboardPath } from '../../context/AuthContext.jsx'

export function UnauthorizedPage() {
  const { user } = useAuth()
  const dashboardPath = user ? getRoleDashboardPath(user.role) : '/login'

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-neutral-200 shadow-lg p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-risk-50 text-risk-600 flex items-center justify-center mx-auto mb-4">
          <ShieldX className="w-8 h-8" />
        </div>
        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-risk-100 text-risk-700 mb-3">
          Error 403 · Access Denied
        </span>
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Unauthorized Access</h1>
        <p className="text-sm text-neutral-600 mb-6">
          Your current account role ({user?.role?.toUpperCase() || 'GUEST'}) does not have permission to view this resource.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to={dashboardPath}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition shadow-sm"
          >
            <Home className="w-4 h-4" />
            Back to My Dashboard
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50 font-medium text-sm transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Switch Account
          </Link>
        </div>
      </div>
    </div>
  )
}
