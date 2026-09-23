// Password hashing (Node's built-in scrypt — no external crypto dependency)
// and signed session tokens (HMAC — a lightweight stand-in for JWT, verified
// the same way, no external library needed).
import crypto from 'node:crypto'

const TOKEN_TTL_MS = 1000 * 60 * 60 * 12 // 12 hours

export function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(plain, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(plain, stored) {
  if (!stored || !stored.includes(':')) return false
  const [salt, hash] = stored.split(':')
  const check = crypto.scryptSync(plain, salt, 64).toString('hex')
  // Timing-safe comparison to avoid leaking hash info via response timing
  const a = Buffer.from(hash, 'hex')
  const b = Buffer.from(check, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function sign(payload, secret) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url')
  return `${data}.${sig}`
}

export function createSessionToken(user) {
  const secret = process.env.AUTH_JWT_SECRET
  if (!secret) throw new Error('AUTH_JWT_SECRET is not set')
  const payload = {
    id: user.id,
    role: user.role,
    jobId: user.jobId || null,
    exp: Date.now() + TOKEN_TTL_MS,
  }
  return sign(payload, secret)
}

export function verifySessionToken(token) {
  const secret = process.env.AUTH_JWT_SECRET
  if (!secret || !token || !token.includes('.')) return null
  const [data, sig] = token.split('.')
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  const payload = JSON.parse(Buffer.from(data, 'base64url').toString())
  if (payload.exp < Date.now()) return null
  return payload
}
