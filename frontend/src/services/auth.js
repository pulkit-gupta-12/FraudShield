import { mockStore } from '../mock/index.js'
import { DEMO_ACCOUNTS } from '../config/constants.js'
import { delay } from '../utils/delay.js'

/**
 * REST Endpoint: POST /api/v1/auth/login/
 */
export async function login(email, password) {
  await delay(350, 650)
  const normalizedEmail = (email || '').trim().toLowerCase()
  const user = DEMO_ACCOUNTS.find((u) => u.email.toLowerCase() === normalizedEmail)

  if (!user) {
    // Also check mockStore users
    const storeUser = mockStore.users.find((u) => u.email.toLowerCase() === normalizedEmail)
    if (storeUser) {
      return { token: `jwt_${storeUser.id}_token`, user: storeUser }
    }
    throw new Error('Invalid email or password. Please use a demo account or register.')
  }

  return {
    token: `jwt_${user.id}_token_mock`,
    user,
  }
}

/**
 * REST Endpoint: POST /api/v1/auth/logout/
 */
export async function logout() {
  await delay(200, 400)
  return { success: true }
}

/**
 * REST Endpoint: GET /api/v1/auth/me/
 */
export async function getCurrentUser(userId) {
  await delay(300, 500)
  const user = mockStore.users.find((u) => u.id === userId) || DEMO_ACCOUNTS[0]
  return user
}

/**
 * REST Endpoint: POST /api/v1/auth/register/
 */
export async function register(userData) {
  await delay(400, 750)
  const newUser = {
    id: `usr_${userData.role || 'customer'}_${Date.now()}`,
    name: userData.name,
    email: userData.email,
    role: userData.role || 'customer',
    status: 'active',
    department: 'Retail Account',
    city: userData.city || 'Mumbai',
    phone: userData.phone || '+91 98000 00000',
    lastLogin: new Date().toISOString(),
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData.name}`,
  }

  mockStore.users.unshift(newUser)
  return { token: `jwt_${newUser.id}_token`, user: newUser }
}
