/**
 * users.js
 *
 * List  : GET /api/users/
 *         Params: { page, pageSize, search, ordering, role }
 *         Returns: { results: User[], count: number }
 *
 * Role  : PATCH /api/users/{id}/role/    body: { role }
 * Status: PATCH /api/users/{id}/status/  body: { status }
 * Invite: POST  /api/users/invite/       body: { email, role, name, department }
 */

import { mockStore } from '../mock/index.js'
import { delay }     from '../utils/delay.js'
import apiClient     from './apiClient.js'

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// GET /api/users/
export async function getUsers(params = {}) {
  if (!USE_MOCK) {
    const { data } = await apiClient.get('/users/', { params })
    return data // { results, count }
  }

  await delay(300, 600)
  const { page = 1, pageSize = 20, search = '', ordering = '', role = 'ALL' } = params

  let list = [...mockStore.users]

  if (role !== 'ALL') list = list.filter((u) => u.role === role)

  if (search) {
    const q = search.toLowerCase()
    list = list.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q),
    )
  }

  if (ordering) {
    const desc = ordering.startsWith('-')
    const key  = desc ? ordering.slice(1) : ordering
    list.sort((a, b) => {
      const av = a[key], bv = b[key]
      if (av === bv) return 0
      return (av > bv ? 1 : -1) * (desc ? -1 : 1)
    })
  }

  const count   = list.length
  const start   = (Number(page) - 1) * Number(pageSize)
  const results = list.slice(start, start + Number(pageSize))

  return { results, count }
}

// PATCH /api/users/{id}/role/  body: { role }
export async function updateUserRole(id, newRole) {
  if (!USE_MOCK) {
    const { data } = await apiClient.patch(`/users/${id}/role/`, { role: newRole })
    return data
  }

  await delay(350, 650)
  const user = mockStore.users.find((u) => u.id === id)
  if (!user) {
    const err = new Error(`User ${id} not found`)
    err.status = 404
    throw err
  }
  user.role = newRole
  return user
}

// PATCH /api/users/{id}/status/  body: { status }
export async function updateUserStatus(id, newStatus) {
  if (!USE_MOCK) {
    const { data } = await apiClient.patch(`/users/${id}/status/`, { status: newStatus })
    return data
  }

  await delay(350, 650)
  const user = mockStore.users.find((u) => u.id === id)
  if (!user) {
    const err = new Error(`User ${id} not found`)
    err.status = 404
    throw err
  }
  user.status = newStatus || (user.status === 'active' ? 'suspended' : 'active')
  return user
}

export async function toggleUserStatus(id) {
  return updateUserStatus(id)
}

// POST /api/users/invite/  body: { email, role, name, department }
export async function inviteUser({ email, role, name, department }) {
  if (!USE_MOCK) {
    const { data } = await apiClient.post('/users/invite/', { email, role, name, department })
    return data
  }

  await delay(450, 750)
  const newUser = {
    id:         `usr_${role}_${Date.now()}`,
    name:       name || email.split('@')[0],
    email,
    role,
    status:     'active',
    department: department || 'Operations',
    city:       'Mumbai',
    phone:      '+91 98000 12345',
    lastLogin:  'Never',
    avatar:     `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
  }

  mockStore.users.unshift(newUser)
  return newUser
}
