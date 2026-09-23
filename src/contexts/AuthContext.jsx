// Holds the logged-in user across the whole app. On mount it asks the
// server "am I still logged in?" via /api/auth-session — this is what
// keeps someone signed in across a page refresh instead of resetting.
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api } from '../apiClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false
    api
      .get('/auth-session')
      .then((data) => {
        if (!cancelled) setUser(data.user)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email, password) => {
    const data = await api.post('/auth-login', { email, password })
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(async () => {
    await api.post('/auth-logout', {})
    setUser(null)
  }, [])

  const value = {
    user,
    checking,
    isLoggedIn: !!user,
    isAdmin: user?.role === 'admin',
    isPm: user?.role === 'pm' || user?.role === 'admin',
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
