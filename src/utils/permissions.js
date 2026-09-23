// Client-side permission checks — purely for UI (hiding/showing buttons).
// These are NOT the real security boundary; every data function on the
// server re-checks permissions independently via requireRole(), so even
// if someone bypasses the UI, the backend still enforces the rules.

export function isAdmin(user) {
  return user?.role === 'admin'
}

export function isPm(user) {
  return user?.role === 'pm' || user?.role === 'admin'
}

export function canApproveRequest(user, request) {
  if (!user || !request) return false
  if (request.status !== 'Pending') return false
  if (isAdmin(user)) return true
  if (user.role !== 'pm') return false
  if (user.id === request.submittedBy) return false
  return user.jobId === request.fromJobId || user.jobId === request.toJobId
}

export function canEditRequest(user, request) {
  if (!user || !request) return false
  if (request.status !== 'Pending') return false
  return isAdmin(user) || user.id === request.submittedBy
}

export function canDeleteRequest(user, request) {
  return canEditRequest(user, request)
}

export function viewerDirection(user, request) {
  return request.submittedBy === user?.id ? 'out' : 'in'
}
