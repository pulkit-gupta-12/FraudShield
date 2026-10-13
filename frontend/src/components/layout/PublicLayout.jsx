import React from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { ShieldCheck, LogIn, LayoutGrid, Github } from 'lucide-react'

export function PublicLayout() {
  const location = useLocation()

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 text-neutral-900">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-primary-600 text-white flex items-center justify-center shadow-sm group-hover:bg-primary-700 transition">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-neutral-900">
              Fraud<span className="text-primary-600">Shield</span>
            </span>
          </Link>

          <nav className="flex items-center gap-3">
            <Link
              to="/ui-kit"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition flex items-center gap-1.5"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              UI Kit
            </Link>

            {location.pathname !== '/login' && (
              <Link
                to="/login"
                className="px-4 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign In
              </Link>
            )}
            {location.pathname === '/login' && (
              <Link
                to="/register"
                className="px-4 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold shadow-xs transition"
              >
                Register
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Main Page Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary-600" />
            <span>FraudShield AI Platform &copy; 2026. Real-Time Detection System.</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/ui-kit" className="hover:text-neutral-900 transition font-medium">UI Components</Link>
            <Link to="/login" className="hover:text-neutral-900 transition font-medium">Demo Portals</Link>
            <span className="text-neutral-400">v0.1.0-alpha</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
