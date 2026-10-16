import React, { createContext, useContext, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { login as apiLogin, logout as apiLogout } from '../services/auth.js'
import { storeTokens, clearTokens, getAccessToken } from '../services/apiClient.js'
import { ROLES, DEMO_ACCOUNTS } from '../config/constants.js'

const AuthContext = createContext(null)

const STORAGE_KEY_USER = 'fraudshield_user'

export function getRoleDashboardPath(role) {
  switch (role) {
    case ROLES.ADMIN:    return '/admin/dashboard'
    case ROLES.ANALYST:  return '/analyst/dashboard'
    case ROLES.CUSTOMER: return '/customer/overview'
    case ROLES.MERCHANT: return '/merchant/overview'
    default:             return '/'
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USER)
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  // 'token' keeps the access token for backward compat with any component that reads useAuth().token
  const [token, setToken] = useState(() => getAccessToken())
  const [loading, setLoading] = useState(false)

  const login = async (email, password) => {
    setLoading(true)
    try {
      // apiLogin returns { token: <access>, user }
      // It already calls storeTokens() internally, so we just sync state.
      const response = await apiLogin(email, password)
      setUser(response.user)
      setToken(response.token)
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(response.user))
      return response.user
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    setLoading(true)
    try {
      await apiLogout()
    } finally {
      // apiLogout calls clearTokens(); mirror in state
      setUser(null)
      setToken(null)
      setLoading(false)
    }
  }

  const switchDemoRole = async (targetRole) => {
    const demo = DEMO_ACCOUNTS.find((a) => a.role === targetRole)
    if (demo) {
      return login(demo.email, demo.password)
    }
  }

  const value = {
    user,
    token,
    isAuthenticated: Boolean(user),
    loading,
    login,
    logout,
    switchDemoRole,
    getRoleDashboardPath,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
