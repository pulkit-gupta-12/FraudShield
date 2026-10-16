/**
 * auth.js
 *
 * Authentication service.
 *
 * Mock mode : validates against DEMO_ACCOUNTS / mockStore and returns a fake token.
 * Real mode : POST /auth/login/ expects { access, refresh, user } from the backend.
 *
 * Tokens are stored by apiClient helpers (storeTokens / clearTokens).
 */

import { mockStore }           from '../mock/index.js'
import { DEMO_ACCOUNTS }       from '../config/constants.js'
import { delay }               from '../utils/delay.js'
import apiClient, { storeTokens, clearTokens, normaliseError } from './apiClient.js'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// POST /auth/login/
// Expects body: { email, password }
// Returns:      { access, refresh, user }
export async function login(email, password) {
  if (!USE_MOCK) {
    try {
      const { data } = await apiClient.post('/auth/login/', { email, password })
      // data = { access, refresh, user }
      storeTokens({ access: data.access, refresh: data.refresh })
      localStorage.setItem('fraudshield_user', JSON.stringify(data.user))
      return { token: data.access, user: data.user }
    } catch (err) {
      throw normaliseError(err)
    }
  }

  // ── Mock ────────────────────────────────────────────────────────────────────
  await delay(350, 650)
  const rawEmail = (email || '').trim().toLowerCase()
  const normalizedEmail = rawEmail.replace('@fraudshield.com', '@fraudshield.io')
  const user = DEMO_ACCOUNTS.find((u) => u.email.toLowerCase() === normalizedEmail || u.email.toLowerCase() === rawEmail)

  if (!user) {
    const storeUser = mockStore.users.find((u) => u.email.toLowerCase() === normalizedEmail || u.email.toLowerCase() === rawEmail)

    if (storeUser) {
      const fakeAccess = `mock_access_${storeUser.id}`
      storeTokens({ access: fakeAccess, refresh: `mock_refresh_${storeUser.id}` })
      return { token: fakeAccess, user: storeUser }
    }
    const err = new Error('Invalid email or password. Please use a demo account.')
    err.status = 401
    err.fields = null
    err._normalised = true
    throw err
  }

  const fakeAccess = `mock_access_${user.id}`
  storeTokens({ access: fakeAccess, refresh: `mock_refresh_${user.id}` })
  return { token: fakeAccess, user }
}

// POST /auth/logout/
// Body: { refresh }  (DRF Simple JWT blacklist)
export async function logout() {
  if (!USE_MOCK) {
    try {
      await apiClient.post('/auth/logout/', {
        refresh: localStorage.getItem('fraudshield_refresh'),
      })
    } catch {
      // Ignore logout errors – clear tokens anyway
    }
  } else {
    await delay(200, 400)
  }

  clearTokens()
  return { success: true }
}

// GET /auth/me/
export async function getCurrentUser() {
  if (!USE_MOCK) {
    const { data } = await apiClient.get('/auth/me/')
    return data
  }

  await delay(300, 500)
  const stored = localStorage.getItem('fraudshield_user')
  if (stored) return JSON.parse(stored)
  return DEMO_ACCOUNTS[0]
}

// POST /auth/register/
// Body: { name, email, password, role, city, phone }
// Returns: { access, refresh, user }
export async function register(userData) {
  if (!USE_MOCK) {
    const { data } = await apiClient.post('/auth/register/', userData)
    storeTokens({ access: data.access, refresh: data.refresh })
    localStorage.setItem('fraudshield_user', JSON.stringify(data.user))
    return { token: data.access, user: data.user }
  }

  await delay(400, 750)
  const newUser = {
    id:         `usr_${userData.role || 'customer'}_${Date.now()}`,
    name:       userData.name,
    email:      userData.email,
    role:       userData.role || 'customer',
    status:     'active',
    department: 'Retail Account',
    city:       userData.city || 'Mumbai',
    phone:      userData.phone || '+91 98000 00000',
    lastLogin:  new Date().toISOString(),
    avatar:     `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData.name}`,
  }

  mockStore.users.unshift(newUser)
  const fakeAccess = `mock_access_${newUser.id}`
  storeTokens({ access: fakeAccess, refresh: `mock_refresh_${newUser.id}` })
  return { token: fakeAccess, user: newUser }
}
