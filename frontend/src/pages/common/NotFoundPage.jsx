import React from 'react'
import { Link } from 'react-router-dom'
import { Compass, Home, ArrowLeft } from 'lucide-react'
import { useAuth, getRoleDashboardPath } from '../../context/AuthContext.jsx'

export function NotFoundPage() {
  const { user } = useAuth()
  const homePath = user ? getRoleDashboardPath(user.role) : '/'

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-neutral-200 shadow-lg p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center mx-auto mb-4">
          <Compass className="w-8 h-8 animate-spin" style={{ animationDuration: '8s' }} />
        </div>
        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-neutral-100 text-neutral-600 mb-3">
          Error 404 · Page Not Found
        </span>
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Lost in Cyberspace?</h1>
        <p className="text-sm text-neutral-600 mb-6">
          The security checkpoint you are trying to reach does not exist or has been moved to another cluster.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to={homePath}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition shadow-sm"
          >
            <Home className="w-4 h-4" />
            Return Home
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50 font-medium text-sm transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </div>
    </div>
  )
}
