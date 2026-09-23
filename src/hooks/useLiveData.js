// Central data hook — fetches jobs/workers/assignments/requests (and
// accounts, if the caller is an admin) and keeps them fresh via polling
// + refetch-on-focus. Netlify Blobs has no realtime push like Supabase
// did, so "live" here means "refreshes automatically on an interval and
// whenever you come back to the tab" rather than instant push — plenty
// for a manpower tracker, but worth knowing that's the mechanism.
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../apiClient'
import { useAuth } from '../contexts/AuthContext'

const POLL_INTERVAL_MS = 20000 // 20s

const EMPTY_DATA = { jobs: [], workers: [], assignments: [], requests: [], accounts: [] }

export function useLiveData() {
  const { user, isAdmin } = useAuth()
  const [data, setData] = useState(EMPTY_DATA)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const inFlight = useRef(false)

  const refresh = useCallback(async () => {
    if (!user || inFlight.current) return
    inFlight.current = true
    try {
      const calls = [api.get('/jobs'), api.get('/workers'), api.get('/assignments'), api.get('/requests')]
      if (isAdmin) calls.push(api.get('/accounts'))

      const results = await Promise.all(calls)
      const [jobsRes, workersRes, assignmentsRes, requestsRes, accountsRes] = results

      setData({
        jobs: jobsRes.jobs,
        workers: workersRes.workers,
        assignments: assignmentsRes.assignments,
        requests: requestsRes.requests,
        accounts: accountsRes ? accountsRes.accounts : [],
      })
      setError(null)
    } catch (err) {
      setError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
      inFlight.current = false
    }
  }, [user, isAdmin])

  // Initial load + reload whenever the logged-in user changes (login/logout/role change)
  useEffect(() => {
    if (!user) {
      setData(EMPTY_DATA)
      setLoading(false)
      return
    }
    setLoading(true)
    refresh()
  }, [user, refresh])

  // Polling
  useEffect(() => {
    if (!user) return
    const id = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [user, refresh])

  // Refetch when the tab regains focus or the window comes back online —
  // catches changes made by other users while this tab was in the background.
  useEffect(() => {
    if (!user) return
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onFocus)
    }
  }, [user, refresh])

  return { data, loading, error, refresh }
}
