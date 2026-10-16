import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserPlus, Mail, Lock, User, Briefcase, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react'
import { register } from '../../services/auth.js'
import { useAuth, getRoleDashboardPath } from '../../context/AuthContext.jsx'
import toast from 'react-hot-toast'

export function RegisterPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'customer',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      navigate(getRoleDashboardPath(user.role), { replace: true })
    }
  }, [user, navigate])

  const validate = () => {
    const errs = {}
    if (!formData.name.trim()) {
      errs.name = 'Full name is required'
    }

    if (!formData.email.trim()) {
      errs.email = 'Email address is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errs.email = 'Valid email address required'
    }

    if (!formData.password) {
      errs.password = 'Password is required'
    } else if (formData.password.length < 6) {
      errs.password = 'Password must be at least 6 characters'
    }

    if (formData.password !== formData.confirmPassword) {
      errs.confirmPassword = 'Passwords do not match'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      await register({
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        role: formData.role,
        password: formData.password,
      })
      toast.success('Registration successful! Please sign in.')
      navigate('/login')
    } catch (err) {
      toast.error(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto p-6 sm:p-8 bg-white rounded-2xl shadow-xl border border-neutral-200">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-100 text-primary-600 mb-3 shadow-inner">
          <UserPlus className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Create an Account</h1>
        <p className="text-xs sm:text-sm text-neutral-500 mt-1">
          Join FraudShield autonomous fraud defense platform
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
            Full Name
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-neutral-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value })
                if (errors.name) setErrors({ ...errors, name: '' })
              }}
              placeholder="e.g. Vikram Malhotra"
              className={`w-full pl-9 pr-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 transition ${
                errors.name ? 'border-red-400 bg-red-50/20' : 'border-neutral-300 focus:border-primary-500'
              }`}
            />
          </div>
          {errors.name && <p className="mt-1 text-[11px] text-red-600 font-medium">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
            Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-neutral-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => {
                setFormData({ ...formData, email: e.target.value })
                if (errors.email) setErrors({ ...errors, email: '' })
              }}
              placeholder="name@company.com"
              className={`w-full pl-9 pr-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 transition ${
                errors.email ? 'border-red-400 bg-red-50/20' : 'border-neutral-300 focus:border-primary-500'
              }`}
            />
          </div>
          {errors.email && <p className="mt-1 text-[11px] text-red-600 font-medium">{errors.email}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
            Role Type
          </label>
          <div className="relative">
            <Briefcase className="w-4 h-4 text-neutral-400 absolute left-3 top-3 pointer-events-none" />
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
            >
              <option value="customer">Customer (Retail Cardholder)</option>
              <option value="analyst">Analyst (Fraud Investigation)</option>
              <option value="admin">Admin (System Governance)</option>
              <option value="merchant">Merchant (Partner Commerce)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
            Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-neutral-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => {
                setFormData({ ...formData, password: e.target.value })
                if (errors.password) setErrors({ ...errors, password: '' })
              }}
              placeholder="••••••••"
              className={`w-full pl-9 pr-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 transition ${
                errors.password ? 'border-red-400 bg-red-50/20' : 'border-neutral-300 focus:border-primary-500'
              }`}
            />
          </div>
          {errors.password && <p className="mt-1 text-[11px] text-red-600 font-medium">{errors.password}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">
            Confirm Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-neutral-400 absolute left-3 top-3 pointer-events-none" />
            <input
              type="password"
              required
              value={formData.confirmPassword}
              onChange={(e) => {
                setFormData({ ...formData, confirmPassword: e.target.value })
                if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: '' })
              }}
              placeholder="••••••••"
              className={`w-full pl-9 pr-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 transition ${
                errors.confirmPassword ? 'border-red-400 bg-red-50/20' : 'border-neutral-300 focus:border-primary-500'
              }`}
            />
          </div>
          {errors.confirmPassword && (
            <p className="mt-1 text-[11px] text-red-600 font-medium">{errors.confirmPassword}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 py-2.5 px-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Creating account...</span>
            </>
          ) : (
            'Complete Registration'
          )}
        </button>
      </form>

      <div className="mt-6 text-center text-xs text-neutral-500">
        Already registered?{' '}
        <Link to="/login" className="font-semibold text-primary-600 hover:underline">
          Sign In to Dashboard
        </Link>
      </div>
    </div>
  )
}

export default RegisterPage
