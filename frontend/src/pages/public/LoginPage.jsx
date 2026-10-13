import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { ShieldAlert, LogIn, Lock, Mail, ArrowRight, UserCheck } from 'lucide-react'
import { useAuth, getRoleDashboardPath } from '../../context/AuthContext.jsx'
import { DEMO_ACCOUNTS } from '../../config/constants.js'
import toast from 'react-hot-toast'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname

  const [email, setEmail] = useState('admin@fraudshield.io')
  const [password, setPassword] = useState('password123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    if (e) e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(email, password)
      toast.success(`Welcome back, ${user.name}!`)
      const dest = from || getRoleDashboardPath(user.role)
      navigate(dest, { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed')
      toast.error(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickLogin = async (demoAccount) => {
    setEmail(demoAccount.email)
    setPassword(demoAccount.password)
    setError('')
    setLoading(true)
    try {
      const user = await login(demoAccount.email, demoAccount.password)
      toast.success(`Logged in as ${user.name} (${user.role.toUpperCase()})`)
      const dest = getRoleDashboardPath(user.role)
      navigate(dest, { replace: true })
    } catch (err) {
      setError(err.message || 'Quick login failed')
      toast.error(err.message || 'Quick login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto p-6 sm:p-8 bg-white rounded-2xl shadow-xl border border-neutral-200">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-100 text-primary-600 mb-3 shadow-inner">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Sign in to FraudShield</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Real-time AI-powered financial fraud detection & operations
        </p>
      </div>

      {/* Quick Demo Personas */}
      <div className="mb-6 bg-neutral-50 p-3.5 rounded-xl border border-neutral-200">
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <UserCheck className="w-3.5 h-3.5 text-primary-600" />
          Click to Demo Any Role:
        </p>
        <div className="grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.id}
              type="button"
              onClick={() => handleQuickLogin(acc)}
              className="flex flex-col text-left px-2.5 py-2 rounded-lg bg-white border border-neutral-200 hover:border-primary-400 hover:bg-primary-50/50 hover:shadow-xs transition text-xs group"
            >
              <span className="font-semibold text-neutral-900 group-hover:text-primary-700 capitalize flex items-center justify-between">
                {acc.role}
                <ArrowRight className="w-3 h-3 text-neutral-400 group-hover:text-primary-600 transition group-hover:translate-x-0.5" />
              </span>
              <span className="text-[11px] text-neutral-500 truncate">{acc.name}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-risk-50 border border-risk-200 text-risk-700 text-xs rounded-lg flex items-center gap-2">
          <span className="font-semibold">Error:</span> {error}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
            Email address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="name@fraudshield.io"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider">
              Password
            </label>
            <a href="#" onClick={(e) => e.preventDefault()} className="text-xs text-primary-600 hover:underline">
              Forgot?
            </a>
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 text-neutral-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 py-2.5 px-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              Sign In
            </>
          )}
        </button>
      </form>

      <div className="mt-6 text-center text-xs text-neutral-500">
        Don't have an account?{' '}
        <Link to="/register" className="font-semibold text-primary-600 hover:underline">
          Register now
        </Link>
      </div>
    </div>
  )
}
