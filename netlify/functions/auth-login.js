import { readCollection, writeCollection } from './utils/store.js'
import { hashPassword, verifyPassword, createSessionToken } from './utils/auth.js'

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid request body' }, 400)
  }

  const email = (body.email || '').trim().toLowerCase()
  const password = body.password || ''

  if (!email || !password) {
    return json({ error: 'Email and password are required' }, 400)
  }

  let accounts = await readCollection('accounts')

  // First-run bootstrap: if no accounts exist yet, create the admin
  // account from environment variables so there's always a way in.
  if (accounts.length === 0) {
    const bootEmail = (process.env.ADMIN_BOOTSTRAP_USERNAME || '').trim().toLowerCase()
    const bootPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD || ''
    if (bootEmail && bootPassword) {
      const admin = {
        id: 'u_' + Date.now().toString(36),
        firstName: 'Admin',
        lastName: 'User',
        email: bootEmail,
        passwordHash: hashPassword(bootPassword),
        role: 'admin',
        jobId: null,
      }
      accounts = [admin]
      await writeCollection('accounts', accounts)
    }
  }

  const account = accounts.find((a) => a.email === email)
  if (!account || !verifyPassword(password, account.passwordHash)) {
    return json({ error: 'Email or password is incorrect' }, 401)
  }

  const token = createSessionToken({
    id: account.id,
    role: account.role,
    jobId: account.jobId || null,
  })

  const user = {
    id: account.id,
    firstName: account.firstName,
    lastName: account.lastName,
    name: `${account.firstName} ${account.lastName}`.trim(),
    email: account.email,
    role: account.role,
    jobId: account.jobId || null,
  }

  return new Response(JSON.stringify({ user }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': buildSessionCookie(token),
    },
  })
}

function buildSessionCookie(token) {
  const maxAge = 60 * 60 * 12 // 12 hours — matches TOKEN_TTL_MS in utils/auth.js
  return `session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
