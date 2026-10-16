/**
 * apiClient.js
 *
 * Axios instance wired to the Django REST backend.
 * All authenticated service calls use this client.
 *
 * Features:
 *  - baseURL from VITE_API_URL (default http://localhost:8000/api)
 *  - Attaches JWT access token from localStorage on every request
 *  - 401 interceptor: tries POST /auth/refresh/ once, then logs out + redirects
 *  - Normalises all errors to { message, status, fields }
 */

import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const STORAGE_KEY_ACCESS  = 'fraudshield_access'
const STORAGE_KEY_REFRESH = 'fraudshield_refresh'
const STORAGE_KEY_USER    = 'fraudshield_user'

// ─── Token helpers ───────────────────────────────────────────────────────────

export function getAccessToken()  { return localStorage.getItem(STORAGE_KEY_ACCESS)  || null }
export function getRefreshToken() { return localStorage.getItem(STORAGE_KEY_REFRESH) || null }

export function storeTokens({ access, refresh }) {
  if (access)  localStorage.setItem(STORAGE_KEY_ACCESS,  access)
  if (refresh) localStorage.setItem(STORAGE_KEY_REFRESH, refresh)
}

export function clearTokens() {
  localStorage.removeItem(STORAGE_KEY_ACCESS)
  localStorage.removeItem(STORAGE_KEY_REFRESH)
  localStorage.removeItem(STORAGE_KEY_USER)
  // Legacy key used in mock mode
  localStorage.removeItem('fraudshield_token')
}

// ─── Axios instance ──────────────────────────────────────────────────────────

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

// ── Request interceptor: attach Bearer token ──────────────────────────────

apiClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken()
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  (err) => Promise.reject(normaliseError(err)),
)

// ── Response interceptor: refresh on 401 ────────────────────────────────────

let _isRefreshing = false
let _refreshQueue = [] // callbacks waiting for new token

function processRefreshQueue(error, token = null) {
  _refreshQueue.forEach((cb) => {
    if (error) cb.reject(error)
    else cb.resolve(token)
  })
  _refreshQueue = []
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      if (_isRefreshing) {
        // Queue this request until refresh is done
        return new Promise((resolve, reject) => {
          _refreshQueue.push({ resolve, reject })
        }).then((newToken) => {
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`
          return apiClient(originalRequest)
        })
      }

      _isRefreshing = true
      const refreshToken = getRefreshToken()

      if (!refreshToken) {
        // No refresh token – log out immediately
        _doLogout()
        _isRefreshing = false
        return Promise.reject(normaliseError(error))
      }

      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh/`, {
          refresh: refreshToken,
        })
        storeTokens({ access: data.access, refresh: data.refresh || refreshToken })
        processRefreshQueue(null, data.access)
        _isRefreshing = false

        originalRequest.headers['Authorization'] = `Bearer ${data.access}`
        return apiClient(originalRequest)
      } catch (refreshErr) {
        processRefreshQueue(refreshErr)
        _isRefreshing = false
        _doLogout()
        return Promise.reject(normaliseError(refreshErr))
      }
    }

    return Promise.reject(normaliseError(error))
  },
)

// ── Logout helper (no circular dep on AuthContext) ──────────────────────────

function _doLogout() {
  clearTokens()
  // Use a brief timeout so the current call stack completes cleanly
  setTimeout(() => {
    window.location.href = '/login'
  }, 0)
}

// ── Error normaliser ─────────────────────────────────────────────────────────

/**
 * Normalises any Axios or network error into:
 *   { message: string, status: number|null, fields: Record<string,string[]>|null }
 */
export function normaliseError(err) {
  if (err && err._normalised) return err

  const status  = err?.response?.status ?? null
  const data    = err?.response?.data

  let message = 'An unexpected error occurred. Please try again.'
  let fields  = null

  if (data) {
    if (typeof data === 'string') {
      message = data
    } else if (typeof data.detail === 'string') {
      message = data.detail
    } else if (typeof data.message === 'string') {
      message = data.message
    } else if (typeof data.non_field_errors?.[0] === 'string') {
      message = data.non_field_errors[0]
    }

    // Django field-level errors: { field: ["msg1", "msg2"] }
    const fieldErrors = {}
    Object.entries(data).forEach(([key, val]) => {
      if (key !== 'detail' && key !== 'message' && Array.isArray(val)) {
        fieldErrors[key] = val
      }
    })
    if (Object.keys(fieldErrors).length) fields = fieldErrors
  } else if (!err?.response) {
    // Network error (no server reached)
    message = 'Network error – unable to reach the server.'
  } else if (status === 404) {
    message = 'The requested resource was not found.'
  } else if (status === 403) {
    message = 'You do not have permission to perform this action.'
  } else if (status === 500) {
    message = 'Server error. Please try again later.'
  }

  const normalised = new Error(message)
  normalised._normalised = true
  normalised.status  = status
  normalised.fields  = fields
  normalised.message = message
  return normalised
}

export default apiClient
