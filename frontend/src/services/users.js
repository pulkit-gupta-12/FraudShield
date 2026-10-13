import { mockStore } from '../mock/index.js'
import { delay } from '../utils/delay.js'

/**
 * REST Endpoint: GET /api/v1/users/
 */
export async function getUsers(params = {}) {
  await delay(300, 600)
  const { role = 'ALL', search = '' } = params

  let list = [...mockStore.users]
  if (role !== 'ALL') {
    list = list.filter((u) => u.role === role)
  }
  if (search) {
    const q = search.toLowerCase()
    list = list.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
  }
  return list
}

/**
 * REST Endpoint: PATCH /api/v1/users/:id/role/
 */
export async function updateUserRole(id, newRole) {
  await delay(350, 650)
  const user = mockStore.users.find((u) => u.id === id)
  if (!user) throw new Error(`User ${id} not found`)

  user.role = newRole
  return user
}

/**
 * REST Endpoint: PATCH /api/v1/users/:id/status/
 */
export async function toggleUserStatus(id) {
  await delay(350, 650)
  const user = mockStore.users.find((u) => u.id === id)
  if (!user) throw new Error(`User ${id} not found`)

  user.status = user.status === 'active' ? 'suspended' : 'active'
  return user
}

/**
 * REST Endpoint: POST /api/v1/users/invite/
 */
export async function inviteUser({ email, role, name, department }) {
  await delay(450, 750)
  const newUser = {
    id: `usr_${role}_${Date.now()}`,
    name: name || email.split('@')[0],
    email,
    role,
    status: 'active',
    department: department || 'Operations',
    city: 'Mumbai',
    phone: '+91 98000 12345',
    lastLogin: 'Never',
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
  }

  mockStore.users.unshift(newUser)
  return newUser
}
