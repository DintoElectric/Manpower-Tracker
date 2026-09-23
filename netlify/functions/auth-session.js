// Called on app load to check "am I still logged in?" — this is what makes
// a page refresh keep you signed in instead of dumping you back to login.
import { readCollection } from './utils/store.js'
import { verifySessionToken } from './utils/auth.js'

export default async (req) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  const token = getCookie(req, 'session')
  const payload = token ? verifySessionToken(token) : null

  if (!payload) {
    return json({ user: null }, 200)
  }

  const accounts = await readCollection('accounts')
  const account = accounts.find((a) => a.id === payload.id)

  if (!account) {
    // Account was deleted since the token was issued
    return json({ user: null }, 200)
  }

  const user = {
    id: account.id,
    firstName: account.firstName,
    lastName: account.lastName,
    name: `${account.firstName} ${account.lastName}`.trim(),
    email: account.email,
    role: account.role,
    jobId: account.jobId || null,
  }

  return json({ user }, 200)
}

function getCookie(req, name) {
  const header = req.headers.get('cookie') || ''
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return match ? match[1] : null
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
