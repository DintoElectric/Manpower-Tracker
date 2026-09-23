// Worker roster CRUD. Reading is available to any logged-in user.
// Creating new workers is admin-only (matches the old "+ Add Worker"
// button being admin-only). Editing worker details is admin or PM
// (matches the old roster screen, where PMs could edit crew records too).
// Deleting is admin-only, with a guard against losing assignment history.
import { readCollection, writeCollection } from './utils/store.js'
import { requireRole, getCaller } from './utils/requireRole.js'

export default async (req) => {
  if (req.method === 'GET') {
    const caller = await getCaller(req)
    if (!caller) return unauthorized()
    const workers = await readCollection('workers')
    return json({ workers })
  }

  if (req.method === 'POST') {
    const { denied } = await requireRole(req, ['admin'])
    if (denied) return denied
    return handleCreate(req)
  }

  if (req.method === 'PUT') {
    const { denied } = await requireRole(req, ['admin', 'pm'])
    if (denied) return denied
    return handleUpdate(req)
  }

  if (req.method === 'DELETE') {
    const { denied } = await requireRole(req, ['admin'])
    if (denied) return denied
    return handleDelete(req)
  }

  return new Response('Method not allowed', { status: 405 })
}

const TRADE_CLASSES = ['General Foreman', 'Foreman', 'Subforeman', 'Journeyman', 'Apprentice', 'Master Electrician']

async function handleCreate(req) {
  const body = await safeJson(req)
  if (!body) return json({ error: 'Invalid request body' }, 400)

  const firstName = (body.firstName || '').trim()
  const lastName = (body.lastName || '').trim()
  if (!firstName) return json({ error: 'First name is required' }, 400)

  const tradeClass = body.tradeClass || 'Journeyman'
  if (!TRADE_CLASSES.includes(tradeClass)) return json({ error: 'Invalid trade class' }, 400)

  const name = `${firstName} ${lastName}`.trim()
  const worker = {
    id: 'w_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    firstName,
    lastName,
    name,
    initials: initials(name),
    tradeClass,
    phone: (body.phone || '').trim() || null,
    createdAt: new Date().toISOString(),
  }

  const workers = await readCollection('workers')
  workers.push(worker)
  await writeCollection('workers', workers)
  return json({ worker }, 201)
}

async function handleUpdate(req) {
  const body = await safeJson(req)
  if (!body || !body.id) return json({ error: 'Worker id is required' }, 400)

  const workers = await readCollection('workers')
  const idx = workers.findIndex((w) => w.id === body.id)
  if (idx === -1) return json({ error: 'Worker not found' }, 404)

  const existing = workers[idx]
  const firstName = body.firstName !== undefined ? body.firstName.trim() : existing.firstName
  const lastName = body.lastName !== undefined ? body.lastName.trim() : existing.lastName
  if (!firstName) return json({ error: 'First name is required' }, 400)

  if (body.tradeClass && !TRADE_CLASSES.includes(body.tradeClass)) {
    return json({ error: 'Invalid trade class' }, 400)
  }

  const name = `${firstName} ${lastName}`.trim()
  workers[idx] = {
    ...existing,
    firstName,
    lastName,
    name,
    initials: initials(name),
    tradeClass: body.tradeClass || existing.tradeClass,
    phone: body.phone !== undefined ? body.phone.trim() || null : existing.phone,
  }

  await writeCollection('workers', workers)
  return json({ worker: workers[idx] })
}

async function handleDelete(req) {
  const body = await safeJson(req)
  if (!body || !body.id) return json({ error: 'Worker id is required' }, 400)

  const [workers, assignments, requests] = await Promise.all([
    readCollection('workers'),
    readCollection('assignments'),
    readCollection('requests'),
  ])

  const target = workers.find((w) => w.id === body.id)
  if (!target) return json({ error: 'Worker not found' }, 404)

  const hasHistory = assignments.some((a) => a.workerId === body.id)
  if (hasHistory) {
    return json({ error: 'This worker has assignment history and cannot be deleted. Consider this a data-integrity guard — ask an admin if the record truly needs to be removed.' }, 400)
  }
  const hasOpenRequests = requests.some((r) => r.workerId === body.id && r.status === 'Pending')
  if (hasOpenRequests) {
    return json({ error: 'This worker has a pending request. Resolve it before deleting.' }, 400)
  }

  const next = workers.filter((w) => w.id !== body.id)
  await writeCollection('workers', next)
  return json({ ok: true })
}

function initials(name) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
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

function unauthorized() {
  return json({ error: 'Not logged in' }, 401)
}
