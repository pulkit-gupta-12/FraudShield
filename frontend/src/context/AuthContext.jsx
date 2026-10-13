import React, { createContext, useContext, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { login as apiLogin, logout as apiLogout } from '../services/auth.js'
import { ROLES, DEMO_ACCOUNTS } from '../config/constants.js'

const AuthContext = createContext(null)

const STORAGE_KEY_USER = 'fraudshield_user'
const STORAGE_KEY_TOKEN = 'fraudshield_token'

export function getRoleDashboardPath(role) {
  switch (role) {
    case ROLES.ADMIN:
      return '/admin/dashboard'
    case ROLES.ANALYST:
      return '/analyst/dashboard'
    case ROLES.CUSTOMER:
      return '/customer/transactions'
    case ROLES.MERCHANT:
      return '/merchant/overview'
    default:
      return '/'
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
  const [token, setToken] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_TOKEN) || null
  })
  const [loading, setLoading] = useState(false)

  const login = async (email, password) => {
    setLoading(true)
    try {
      const response = await apiLogin(email, password)
      setUser(response.user)
      setToken(response.token)
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(response.user))
      localStorage.setItem(STORAGE_KEY_TOKEN, response.token)
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
      setUser(null)
      setToken(null)
      localStorage.removeItem(STORAGE_KEY_USER)
      localStorage.removeItem(STORAGE_KEY_TOKEN)
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
