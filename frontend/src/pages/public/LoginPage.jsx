import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { ShieldAlert, LogIn, Lock, Mail, ArrowRight, UserCheck, AlertCircle } from 'lucide-react'
import { useAuth, getRoleDashboardPath } from '../../context/AuthContext.jsx'
import { DEMO_ACCOUNTS } from '../../config/constants.js'
import toast from 'react-hot-toast'

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname

  const [email, setEmail] = useState('customer@fraudshield.io')
  const [password, setPassword] = useState('password123')
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [validationErrors, setValidationErrors] = useState({})

  useEffect(() => {
    if (user) {
      navigate(from || getRoleDashboardPath(user.role), { replace: true })
    }
  }, [user, navigate, from])

  // Form field validation
  const validateForm = () => {
    const errors = {}
    if (!email.trim()) {
      errors.email = 'Email address is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email format (e.g. user@domain.com)'
    }

    if (!password) {
      errors.password = 'Password is required'
    } else if (password.length < 4) {
      errors.password = 'Password must be at least 4 characters'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleLogin = async (e) => {
    if (e) e.preventDefault()
    setError('')

    if (!validateForm()) {
      return
    }

    setLoading(true)
    try {
      const user = await login(email.trim(), password)
      toast.success(`Welcome back, ${user.name}!`)
      const dest = from || getRoleDashboardPath(user.role)
      navigate(dest, { replace: true })
    } catch (err) {
      const msg = err.message || 'Invalid email or password. Please check your credentials.'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  // Quick Demo Account selection
  const handleQuickLogin = async (demoAccount) => {
    setEmail(demoAccount.email)
    setPassword(demoAccount.password)
    setError('')
    setValidationErrors({})
    setLoading(true)
    try {
      const user = await login(demoAccount.email, demoAccount.password)
      toast.success(`Logged in as ${user.name} (${user.role.toUpperCase()})`)
      const dest = getRoleDashboardPath(user.role)
      navigate(dest, { replace: true })
    } catch (err) {
      const msg = err.message || 'Quick login failed'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto p-6 sm:p-8 bg-white rounded-2xl shadow-xl border border-neutral-200">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-100 text-primary-600 mb-3 shadow-inner">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Sign in to FraudShield</h1>
        <p className="text-xs sm:text-sm text-neutral-500 mt-1">
          Real-time AI-powered financial fraud detection & operations
        </p>
      </div>

      {/* Quick Demo Persona Chips */}
      <div className="mb-6 bg-neutral-50 p-3.5 rounded-xl border border-neutral-200">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wider flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-primary-600" />
            Quick Demo Accounts:
          </p>
          <span className="text-[10px] text-neutral-400 font-mono">1-Click Sign In</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.id}
              type="button"
              id={`login-chip-${acc.role}`}
              disabled={loading}
              onClick={() => handleQuickLogin(acc)}
              className="flex flex-col text-left px-2.5 py-2 rounded-lg bg-white border border-neutral-200 hover:border-primary-400 hover:bg-primary-50/50 hover:shadow-xs transition text-xs group disabled:opacity-50"
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

      {/* Clear Authentication Error Banner */}
      {error && (
        <div
          id="login-error-banner"
          className="mb-4 p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2.5 animate-shake"
        >
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Authentication failed: </span>
            {error}
          </div>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4" noValidate>
        <div>
          <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1.5">
            Email address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="email"
              id="login-email-input"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (validationErrors.email) {
                  setValidationErrors({ ...validationErrors, email: '' })
                }
              }}
              placeholder="e.g. customer@fraudshield.io"
              className={`w-full pl-9 pr-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 transition ${
                validationErrors.email
                  ? 'border-red-400 focus:ring-red-500/20 focus:border-red-500 bg-red-50/30'
                  : 'border-neutral-300 focus:ring-primary-500/20 focus:border-primary-500'
              }`}
            />
          </div>
          {validationErrors.email && (
            <p className="mt-1 text-[11px] text-red-600 font-medium">{validationErrors.email}</p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider">
              Password
            </label>
            <button
              type="button"
              onClick={() => toast('Password reset link simulated in demo mode.', { icon: 'ℹ️' })}
              className="text-xs text-primary-600 hover:underline"
            >
              Forgot?
            </button>
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 text-neutral-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="password"
              id="login-password-input"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (validationErrors.password) {
                  setValidationErrors({ ...validationErrors, password: '' })
                }
              }}
              placeholder="••••••••"
              className={`w-full pl-9 pr-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 transition ${
                validationErrors.password
                  ? 'border-red-400 focus:ring-red-500/20 focus:border-red-500 bg-red-50/30'
                  : 'border-neutral-300 focus:ring-primary-500/20 focus:border-primary-500'
              }`}
            />
          </div>
          {validationErrors.password && (
            <p className="mt-1 text-[11px] text-red-600 font-medium">{validationErrors.password}</p>
          )}
        </div>

        <div className="flex items-center justify-between text-xs">
          <label className="flex items-center gap-2 text-neutral-600 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
            />
            <span>Remember this device</span>
          </label>
        </div>

        {/* Lock button during loading */}
        <button
          type="submit"
          id="login-submit-button"
          disabled={loading}
          className="w-full mt-2 py-2.5 px-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Verifying credentials...</span>
            </>
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              <span>Sign In to Dashboard</span>
            </>
          )}
        </button>
      </form>

      <div className="mt-6 text-center text-xs text-neutral-500">
        Don't have an account?{' '}
        <Link to="/register" className="font-semibold text-primary-600 hover:underline">
          Register new account
        </Link>
      </div>
    </div>
  )
}

export default LoginPage
