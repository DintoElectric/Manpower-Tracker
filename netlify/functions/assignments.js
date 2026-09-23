// Assignment history — which worker is on which job, and when. This is
// the core "who moved where" record the whole tracker is built around.
// Reading is available to any logged-in user; creating/editing is admin
// or PM (matches the old "+ Assign" button); deleting a record outright
// is admin-only (history should normally be closed out, not erased).
import { readCollection, writeCollection } from './utils/store.js'
import { requireRole, getCaller } from './utils/requireRole.js'

export default async (req) => {
  if (req.method === 'GET') {
    const caller = await getCaller(req)
    if (!caller) return unauthorized()
    const assignments = await readCollection('assignments')
    return json({ assignments })
  }

  if (req.method === 'POST') {
    const { caller, denied } = await requireRole(req, ['admin', 'pm'])
    if (denied) return denied
    return handleCreate(req, caller)
  }

  if (req.method === 'PUT') {
    const { caller, denied } = await requireRole(req, ['admin', 'pm'])
    if (denied) return denied
    return handleUpdate(req, caller)
  }

  if (req.method === 'DELETE') {
    const { denied } = await requireRole(req, ['admin'])
    if (denied) return denied
    return handleDelete(req)
  }

  return new Response('Method not allowed', { status: 405 })
}

async function handleCreate(req, caller) {
  const body = await safeJson(req)
  if (!body) return json({ error: 'Invalid request body' }, 400)

  const { workerId, jobId, startDate } = body
  if (!workerId || !jobId || !startDate) {
    return json({ error: 'Worker, job, and start date are required' }, 400)
  }

  const isPermanent = !!body.isPermanent
  const endDate = isPermanent ? null : body.endDate || null
  if (endDate && endDate < startDate) {
    return json({ error: 'End date cannot be before start date' }, 400)
  }

  const [workers, jobs, assignments] = await Promise.all([
    readCollection('workers'),
    readCollection('jobs'),
    readCollection('assignments'),
  ])

  if (!workers.some((w) => w.id === workerId)) return json({ error: 'Worker not found' }, 404)
  if (!jobs.some((j) => j.id === jobId)) return json({ error: 'Job not found' }, 404)

  // Auto-close any open-ended/permanent assignment this worker already has
  // that would otherwise overlap the new one — prevents a worker silently
  // showing as "on" two jobs at once.
  const dayBefore = shiftDay(startDate, -1)
  let closedPreviousId = null
  for (const a of assignments) {
    if (a.workerId !== workerId) continue
    const isOpenEnded = a.isPermanent || !a.endDate
    const overlaps = isOpenEnded && a.startDate <= startDate
    if (overlaps) {
      a.isPermanent = false
      a.endDate = dayBefore >= a.startDate ? dayBefore : a.startDate
      closedPreviousId = a.id
    }
  }

  const assignment = {
    id: 'a_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    workerId,
    jobId,
    startDate,
    endDate,
    isPermanent,
    createdBy: caller.id,
    createdAt: new Date().toISOString(),
  }

  assignments.push(assignment)
  await writeCollection('assignments', assignments)
  return json({ assignment, closedPreviousId }, 201)
}

async function handleUpdate(req) {
  const body = await safeJson(req)
  if (!body || !body.id) return json({ error: 'Assignment id is required' }, 400)

  const assignments = await readCollection('assignments')
  const idx = assignments.findIndex((a) => a.id === body.id)
  if (idx === -1) return json({ error: 'Assignment not found' }, 404)

  const existing = assignments[idx]
  const isPermanent = body.isPermanent !== undefined ? !!body.isPermanent : existing.isPermanent
  const startDate = body.startDate || existing.startDate
  const endDate = isPermanent ? null : (body.endDate !== undefined ? body.endDate : existing.endDate)

  if (endDate && endDate < startDate) {
    return json({ error: 'End date cannot be before start date' }, 400)
  }

  assignments[idx] = { ...existing, startDate, endDate, isPermanent }
  await writeCollection('assignments', assignments)
  return json({ assignment: assignments[idx] })
}

async function handleDelete(req) {
  const body = await safeJson(req)
  if (!body || !body.id) return json({ error: 'Assignment id is required' }, 400)

  const assignments = await readCollection('assignments')
  if (!assignments.some((a) => a.id === body.id)) return json({ error: 'Assignment not found' }, 404)

  const next = assignments.filter((a) => a.id !== body.id)
  await writeCollection('assignments', next)
  return json({ ok: true })
}

function shiftDay(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + delta)
  return d.toISOString().slice(0, 10)
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
