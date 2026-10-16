import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShieldAlert, ArrowLeft, Home, LogOut } from 'lucide-react'
import { useAuth, getRoleDashboardPath } from '../../context/AuthContext.jsx'

export function UnauthorizedPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const dashboardPath = user ? getRoleDashboardPath(user.role) : '/login'

  const handleSignOut = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-neutral-200 shadow-xl p-8 text-center">
        {/* Warning Icon */}
        <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-100 shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-100 text-red-700 mb-3 border border-red-200">
          Error 403 · Access Forbidden
        </span>

        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Restricted Security Perimeter</h1>

        <p className="text-sm text-neutral-600 mb-6 leading-relaxed">
          Your current authenticated persona (
          <span className="font-bold text-neutral-900 uppercase">
            {user?.role || 'Guest'}
          </span>
          ) does not hold authorization clearance for this specific route.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to={dashboardPath}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs shadow-sm transition"
          >
            <Home className="w-4 h-4" />
            Back to My Dashboard
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50 font-semibold text-xs transition"
          >
            <LogOut className="w-4 h-4" />
            Sign Out & Switch Account
          </button>
        </div>
      </div>
    </div>
  )
}

export default UnauthorizedPage
