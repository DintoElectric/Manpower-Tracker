// Shared logic for moving/removing a worker's job assignment, used by
// both the Roster drag-and-drop and (eventually) the Jobs page's Remove
// button — one place for "what does reassigning actually do" so drag-drop
// and the manual modal stay behaviorally identical.
import { api } from '../apiClient'
import { shiftDay, todayStr } from './dates'

// Moves a worker onto a new job starting today. Defaults to permanent/
// ongoing since there's no date picker in a drag gesture — the backend
// already auto-closes their previous open-ended assignment (see
// netlify/functions/assignments.js), so this is safe to call directly.
export async function moveWorkerToJob(workerId, jobId) {
  return api.post('/assignments', {
    workerId,
    jobId,
    startDate: todayStr(),
    isPermanent: true,
  })
}

// Closes out a worker's current assignment on a given job (sets end date
// to yesterday) rather than deleting the record, preserving history —
// used when dragging a worker to "Yard / Available", or the Jobs page's
// Remove button.
export async function removeWorkerFromJob(workerId, jobId, assignments) {
  const yesterday = shiftDay(todayStr(), -1)
  const active = assignments
    .filter((a) => a.workerId === workerId && a.jobId === jobId)
    .sort((a, b) => (b.startDate > a.startDate ? 1 : -1))
    .find((a) => a.isPermanent || !a.endDate || a.endDate >= todayStr())

  if (!active) return null
  return api.put('/assignments', { id: active.id, isPermanent: false, endDate: yesterday })
}
