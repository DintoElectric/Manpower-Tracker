// Thin fetch wrapper used by every page/hook to talk to the Netlify
// Functions. Always sends the session cookie (credentials: 'include')
// and normalizes error handling so callers don't repeat try/catch boilerplate.

const BASE = '/api'

class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })

  let body = null
  try {
    body = await res.json()
  } catch {
    // Some responses (e.g. logout) may have no body — that's fine.
  }

  if (!res.ok) {
    const message = body?.error || `Request failed (${res.status})`
    throw new ApiError(message, res.status)
  }

  return body
}

export const api = {
  get: (path) => request(path, { method: 'GET' }),
  post: (path, data) => request(path, { method: 'POST', body: JSON.stringify(data) }),
  put: (path, data) => request(path, { method: 'PUT', body: JSON.stringify(data) }),
  del: (path, data) => request(path, { method: 'DELETE', body: JSON.stringify(data) }),
}

export { ApiError }
