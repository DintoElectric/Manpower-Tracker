// Manpower requests — the PM-to-PM crew transfer workflow. A request is
// always stored from the submitter's point of view (fromJobId releases,
// toJobId receives); each viewer's "incoming" vs "outgoing" label is
// computed client-side by comparing submittedBy to the logged-in user.
//
// Approving a person-type request now actually creates the assignment
// (closing out the worker's previous one) instead of just flipping a
// status flag — this is what makes movements real, not just paperwork.
import { readCollection, writeCollection } from './utils/store.js'
import { requireRole, getCaller } from './utils/requireRole.js'

export default async (req) => {
  if (req.method === 'GET') {
    const caller = await getCaller(req)
    if (!caller) return unauthorized()
    const requests = await readCollection('requests')
    return json({ requests })
  }

  if (req.method === 'POST') {
    const { caller, denied } = await requireRole(req, ['admin', 'pm'])
    if (denied) return denied
    return handleCreate(req, caller)
  }

  if (req.method === 'PUT') {
    const { caller, denied } = await requireRole(req, ['admin', 'pm'])
    if (denied) return denied
    const body = await safeJson(req)
    if (!body || !body.id) return json({ error: 'Request id is required' }, 400)
    if (body.action === 'approve' || body.action === 'deny') {
      return handleResolve(body, caller)
    }
    return handleUpdate(body, caller)
  }

  if (req.method === 'DELETE') {
    const { caller, denied } = await requireRole(req, ['admin', 'pm'])
    if (denied) return denied
    return handleDelete(req, caller)
  }

  return new Response('Method not allowed', { status: 405 })
}

const PRIORITIES = ['Urgent', 'High', 'Normal', 'Low']

async function handleCreate(req, caller) {
  const body = await safeJson(req)
  if (!body) return json({ error: 'Invalid request body' }, 400)

  const requestType = body.requestType === 'role' ? 'role' : 'person'
  const fromJobId = body.fromJobId
  const toJobId = body.toJobId
  if (!fromJobId || !toJobId) return json({ error: 'Both jobs are required' }, 400)
  if (fromJobId === toJobId) return json({ error: 'From and to jobs must be different' }, 400)

  const [jobs, workers] = await Promise.all([readCollection('jobs'), readCollection('workers')])
  if (!jobs.some((j) => j.id === fromJobId)) return json({ error: 'Releasing job not found' }, 404)
  if (!jobs.some((j) => j.id === toJobId)) return json({ error: 'Receiving job not found' }, 404)

  let workerId = null, workerName = '', workerRole = ''
  if (requestType === 'person') {
    const worker = workers.find((w) => w.id === body.workerId)
    if (!worker) return json({ error: 'Please select a worker' }, 400)
    workerId = worker.id
    workerName = worker.name
    workerRole = worker.tradeClass
  }

  const isPermanent = !!body.isPermanent
  const priority = PRIORITIES.includes(body.priority) ? body.priority : 'Normal'

  const request = {
    id: 'req_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    requestType,
    workerId,
    workerName,
    workerRole,
    roleRequested: requestType === 'role' ? (body.roleRequested || '') : '',
    qty: requestType === 'role' ? Math.max(1, parseInt(body.qty) || 1) : 1,
    fromJobId,
    toJobId,
    counterPmId: body.counterPmId || null,
    isPermanent,
    startDate: isPermanent ? null : (body.startDate || null),
    endDate: isPermanent ? null : (body.endDate || null),
    priority,
    status: 'Pending',
    submittedBy: caller.id,
    submittedAt: new Date().toISOString(),
    note: (body.note || '').trim(),
  }

  const requests = await readCollection('requests')
  requests.unshift(request)
  await writeCollection('requests', requests)
  return json({ request }, 201)
}

async function handleUpdate(body, caller) {
  const requests = await readCollection('requests')
  const idx = requests.findIndex((r) => r.id === body.id)
  if (idx === -1) return json({ error: 'Request not found' }, 404)

  const existing = requests[idx]
  if (existing.status !== 'Pending') return json({ error: 'Only pending requests can be edited' }, 400)
  if (existing.submittedBy !== caller.id && caller.role !== 'admin') {
    return json({ error: 'Only the submitter or an admin can edit this request' }, 403)
  }

  const isPermanent = body.isPermanent !== undefined ? !!body.isPermanent : existing.isPermanent
  requests[idx] = {
    ...existing,
    priority: PRIORITIES.includes(body.priority) ? body.priority : existing.priority,
    isPermanent,
    startDate: isPermanent ? null : (body.startDate !== undefined ? body.startDate : existing.startDate),
    endDate: isPermanent ? null : (body.endDate !== undefined ? body.endDate : existing.endDate),
    note: body.note !== undefined ? body.note.trim() : existing.note,
    counterPmId: body.counterPmId !== undefined ? body.counterPmId : existing.counterPmId,
  }

  await writeCollection('requests', requests)
  return json({ request: requests[idx] })
}

async function handleResolve(body, caller) {
  const requests = await readCollection('requests')
  const idx = requests.findIndex((r) => r.id === body.id)
  if (idx === -1) return json({ error: 'Request not found' }, 404)

  const request = requests[idx]
  if (request.status !== 'Pending') return json({ error: 'This request has already been resolved' }, 400)

  // Only an admin, or a PM tied to either job on the request (and not the
  // person who submitted it), can approve/deny — mirrors the old "incoming"
  // rule but enforced server-side now instead of just hidden in the UI.
  const isRelatedPm =
    caller.role === 'pm' &&
    caller.id !== request.submittedBy &&
    (caller.jobId === request.fromJobId || caller.jobId === request.toJobId)
  if (caller.role !== 'admin' && !isRelatedPm) {
    return json({ error: 'You are not permitted to resolve this request' }, 403)
  }

  const status = body.action === 'approve' ? 'Approved' : 'Denied'
  let createdAssignmentId = null

  if (status === 'Approved' && request.requestType === 'person' && request.workerId) {
    const assignments = await readCollection('assignments')
    const startDate = request.startDate || today()
    const dayBefore = shiftDay(startDate, -1)

    for (const a of assignments) {
      if (a.workerId !== request.workerId) continue
      const isOpenEnded = a.isPermanent || !a.endDate
      if (isOpenEnded && a.startDate <= startDate) {
        a.isPermanent = false
        a.endDate = dayBefore >= a.startDate ? dayBefore : a.startDate
      }
    }

    const assignment = {
      id: 'a_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      workerId: request.workerId,
      jobId: request.toJobId,
      startDate,
      endDate: request.isPermanent ? null : (request.endDate || null),
      isPermanent: request.isPermanent,
      createdBy: caller.id,
      createdFromRequestId: request.id,
      createdAt: new Date().toISOString(),
    }
    assignments.push(assignment)
    await writeCollection('assignments', assignments)
    createdAssignmentId = assignment.id
  }

  requests[idx] = {
    ...request,
    status,
    resolvedBy: caller.id,
    resolvedAt: new Date().toISOString(),
  }
  await writeCollection('requests', requests)
  return json({ request: requests[idx], createdAssignmentId })
}

async function handleDelete(req, caller) {
  const body = await safeJson(req)
  if (!body || !body.id) return json({ error: 'Request id is required' }, 400)

  const requests = await readCollection('requests')
  const existing = requests.find((r) => r.id === body.id)
  if (!existing) return json({ error: 'Request not found' }, 404)

  if (caller.role !== 'admin' && existing.submittedBy !== caller.id) {
    return json({ error: 'Only the submitter or an admin can delete this request' }, 403)
  }

  const next = requests.filter((r) => r.id !== body.id)
  await writeCollection('requests', next)
  return json({ ok: true })
}

function today() {
  return new Date().toISOString().slice(0, 10)
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
