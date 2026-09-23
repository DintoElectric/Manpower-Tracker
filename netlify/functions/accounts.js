// Full CRUD for user accounts — admin-only for every operation, since
// account creation/management is restricted to admins per your workflow.
import { readCollection, writeCollection } from './utils/store.js'
import { requireRole } from './utils/requireRole.js'
import { hashPassword } from './utils/auth.js'

export default async (req) => {
  const { caller, denied } = await requireRole(req, ['admin'])
  if (denied) return denied

  switch (req.method) {
    case 'GET':
      return handleList()
    case 'POST':
      return handleCreate(req)
    case 'PUT':
      return handleUpdate(req, caller)
    case 'DELETE':
      return handleDelete(req, caller)
    default:
      return new Response('Method not allowed', { status: 405 })
  }
}

async function handleList() {
  const accounts = await readCollection('accounts')
  return json({ accounts: accounts.map(toPublic) })
}

async function handleCreate(req) {
  const body = await safeJson(req)
  if (!body) return json({ error: 'Invalid request body' }, 400)

  const firstName = (body.firstName || '').trim()
  const lastName = (body.lastName || '').trim()
  const email = (body.email || '').trim().toLowerCase()
  const password = body.password || ''
  const role = body.role || 'pm'
  const jobId = body.jobId || null

  if (!firstName || !lastName) return json({ error: 'Full name is required' }, 400)
  if (!email) return json({ error: 'Email is required' }, 400)
  if (password.length < 6) return json({ error: 'Password must be at least 6 characters' }, 400)
  if (!['admin', 'pm', 'foreman'].includes(role)) return json({ error: 'Invalid role' }, 400)

  const accounts = await readCollection('accounts')
  if (accounts.some((a) => a.email === email)) {
    return json({ error: 'An account with that email already exists' }, 409)
  }

  const account = {
    id: 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    firstName,
    lastName,
    email,
    passwordHash: hashPassword(password),
    role,
    jobId,
    createdAt: new Date().toISOString(),
  }

  accounts.push(account)
  await writeCollection('accounts', accounts)
  return json({ account: toPublic(account) }, 201)
}

async function handleUpdate(req, caller) {
  const body = await safeJson(req)
  if (!body || !body.id) return json({ error: 'Account id is required' }, 400)

  const accounts = await readCollection('accounts')
  const idx = accounts.findIndex((a) => a.id === body.id)
  if (idx === -1) return json({ error: 'Account not found' }, 404)

  const existing = accounts[idx]
  const email = body.email ? body.email.trim().toLowerCase() : existing.email

  if (email !== existing.email && accounts.some((a) => a.email === email && a.id !== existing.id)) {
    return json({ error: 'An account with that email already exists' }, 409)
  }

  if (body.role && !['admin', 'pm', 'foreman'].includes(body.role)) {
    return json({ error: 'Invalid role' }, 400)
  }

  // Prevent an admin from locking themselves out by demoting their own last admin account
  if (existing.id === caller.id && body.role && body.role !== 'admin') {
    const otherAdmins = accounts.filter((a) => a.role === 'admin' && a.id !== existing.id)
    if (otherAdmins.length === 0) {
      return json({ error: 'You cannot remove admin from the only remaining admin account' }, 400)
    }
  }

  const updated = {
    ...existing,
    firstName: body.firstName !== undefined ? body.firstName.trim() : existing.firstName,
    lastName: body.lastName !== undefined ? body.lastName.trim() : existing.lastName,
    email,
    role: body.role || existing.role,
    jobId: body.jobId !== undefined ? body.jobId : existing.jobId,
    passwordHash: body.password ? hashPassword(body.password) : existing.passwordHash,
  }

  accounts[idx] = updated
  await writeCollection('accounts', accounts)
  return json({ account: toPublic(updated) })
}

async function handleDelete(req, caller) {
  const body = await safeJson(req)
  if (!body || !body.id) return json({ error: 'Account id is required' }, 400)

  if (body.id === caller.id) {
    return json({ error: "You can't delete your own account" }, 400)
  }

  const accounts = await readCollection('accounts')
  const target = accounts.find((a) => a.id === body.id)
  if (!target) return json({ error: 'Account not found' }, 404)

  if (target.role === 'admin') {
    const otherAdmins = accounts.filter((a) => a.role === 'admin' && a.id !== target.id)
    if (otherAdmins.length === 0) {
      return json({ error: 'Cannot delete the only remaining admin account' }, 400)
    }
  }

  const next = accounts.filter((a) => a.id !== body.id)
  await writeCollection('accounts', next)
  return json({ ok: true })
}

// Never send passwordHash to the client, under any circumstance.
function toPublic(account) {
  const { passwordHash, ...rest } = account
  return { ...rest, name: `${account.firstName} ${account.lastName}`.trim() }
}

async function safeJson(req) {
  try {
    return await req.json()
  } catch {
    return null
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
