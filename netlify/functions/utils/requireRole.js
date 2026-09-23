// Shared guard used by every data function to check who's making the
// request and whether they're allowed to do it, based on their session
// cookie — never trust a role or user id sent in the request body itself.
import { readCollection } from './store.js'
import { verifySessionToken } from './auth.js'

function getCookie(req, name) {
  const header = req.headers.get('cookie') || ''
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return match ? match[1] : null
}

// Resolves the current caller from their session cookie, or null if
// they're not logged in / their token is invalid or expired.
export async function getCaller(req) {
  const token = getCookie(req, 'session')
  const payload = token ? verifySessionToken(token) : null
  if (!payload) return null

  const accounts = await readCollection('accounts')
  const account = accounts.find((a) => a.id === payload.id)
  if (!account) return null

  return {
    id: account.id,
    role: account.role,
    jobId: account.jobId || null,
  }
}

// Throws-as-response pattern: call this at the top of a function handler.
// allowedRoles is an array like ['admin'] or ['admin', 'pm'].
// Returns the caller if allowed; returns a Response to send back immediately if not.
export async function requireRole(req, allowedRoles) {
  const caller = await getCaller(req)
  if (!caller) {
    return { caller: null, denied: unauthorized('Not logged in') }
  }
  if (!allowedRoles.includes(caller.role)) {
    return { caller: null, denied: unauthorized('Not permitted', 403) }
  }
  return { caller, denied: null }
}

function unauthorized(message, status = 401) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
