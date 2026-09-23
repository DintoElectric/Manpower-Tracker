// Shared lookups used across Dashboard/Schedule/Roster/Jobs — kept in one
// place so "which job is this worker on right now" is computed identically
// everywhere instead of drifting between screens.
import { todayStr } from './dates'

export const YARD_JOB = { id: 'YARD', name: 'Yard / Unassigned', shortName: 'Available', color: '#a1a1aa', number: '' }

// Returns the jobId a worker is currently assigned to as of today,
// or 'YARD' if they have no active assignment.
export function currentJobId(worker, assignments, asOf = todayStr()) {
  const mine = assignments
    .filter((a) => a.workerId === worker.id)
    .sort((a, b) => (a.startDate > b.startDate ? -1 : 1))

  for (const a of mine) {
    const endsOk = a.isPermanent || !a.endDate || a.endDate >= asOf
    if (a.startDate <= asOf && endsOk) return a.jobId
  }
  // No assignment covers today — fall back to their most recent one, if any
  if (mine.length) return mine[0].jobId
  return 'YARD'
}

export function jobById(jobs, id) {
  return jobs.find((j) => j.id === id) || YARD_JOB
}

export function accountById(accounts, id) {
  return accounts.find((a) => a.id === id) || null
}

export function workerById(workers, id) {
  return workers.find((w) => w.id === id) || null
}
