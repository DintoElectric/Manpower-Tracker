// Jobs CRUD. Reading the job list is available to any logged-in user
// (everyone needs to see all company jobs to route crew between them);
// creating/editing/deleting a job is admin-only.
import { readCollection, writeCollection } from './utils/store.js'
import { requireRole, getCaller } from './utils/requireRole.js'

export default async (req) => {
  if (req.method === 'GET') {
    const caller = await getCaller(req)
    if (!caller) return unauthorized()
    const jobs = await readCollection('jobs')
    return json({ jobs })
  }

  const { caller, denied } = await requireRole(req, ['admin'])
  if (denied) return denied

  switch (req.method) {
    case 'POST':
      return handleCreate(req)
    case 'PUT':
      return handleUpdate(req)
    case 'DELETE':
      return handleDelete(req)
    default:
      return new Response('Method not allowed', { status: 405 })
  }
}

async function handleCreate(req) {
  const body = await safeJson(req)
  if (!body) return json({ error: 'Invalid request body' }, 400)

  const name = (body.name || '').trim()
  if (!name) return json({ error: 'Job name is required' }, 400)

  const job = {
    id: 'j_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    shortName: (body.shortName || name).trim(),
    number: (body.number || '').trim() || null,
    location: (body.location || '').trim() || null,
    phase: (body.phase || '').trim() || null,
    status: body.status || 'Active',
    pmId: body.pmId || null,
    color: body.color || '#E2123C',
    startDate: body.startDate || null,
    createdAt: new Date().toISOString(),
  }

  const jobs = await readCollection('jobs')
  jobs.push(job)
  await writeCollection('jobs', jobs)
  return json({ job }, 201)
}

async function handleUpdate(req) {
  const body = await safeJson(req)
  if (!body || !body.id) return json({ error: 'Job id is required' }, 400)

  const jobs = await readCollection('jobs')
  const idx = jobs.findIndex((j) => j.id === body.id)
  if (idx === -1) return json({ error: 'Job not found' }, 404)

  const existing = jobs[idx]
  const name = body.name !== undefined ? body.name.trim() : existing.name
  if (!name) return json({ error: 'Job name is required' }, 400)

  jobs[idx] = {
    ...existing,
    name,
    shortName: body.shortName !== undefined ? body.shortName.trim() || name : existing.shortName,
    number: body.number !== undefined ? body.number.trim() || null : existing.number,
    location: body.location !== undefined ? body.location.trim() || null : existing.location,
    phase: body.phase !== undefined ? body.phase.trim() || null : existing.phase,
    status: body.status || existing.status,
    pmId: body.pmId !== undefined ? body.pmId : existing.pmId,
    color: body.color || existing.color,
    startDate: body.startDate !== undefined ? body.startDate : existing.startDate,
  }

  await writeCollection('jobs', jobs)
  return json({ job: jobs[idx] })
}

async function handleDelete(req) {
  const body = await safeJson(req)
  if (!body || !body.id) return json({ error: 'Job id is required' }, 400)

  const [jobs, workers, assignments, requests] = await Promise.all([
    readCollection('jobs'),
    readCollection('workers'),
    readCollection('assignments'),
    readCollection('requests'),
  ])

  const target = jobs.find((j) => j.id === body.id)
  if (!target) return json({ error: 'Job not found' }, 404)

  // Guard rails: don't let a job with active crew or open requests
  // disappear silently and orphan that data.
  const hasActiveCrew = assignments.some(
    (a) => a.jobId === body.id && (a.isPermanent || !a.endDate || a.endDate >= today())
  )
  if (hasActiveCrew) {
    return json({ error: 'This job still has crew assigned. Reassign them before deleting.' }, 400)
  }
  const hasOpenRequests = requests.some(
    (r) => (r.fromJobId === body.id || r.toJobId === body.id) && r.status === 'Pending'
  )
  if (hasOpenRequests) {
    return json({ error: 'This job has pending requests. Resolve them before deleting.' }, 400)
  }

  const next = jobs.filter((j) => j.id !== body.id)
  await writeCollection('jobs', next)
  return json({ ok: true })
}

function today() {
  return new Date().toISOString().slice(0, 10)
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
