// Sign-in screen only — no self-registration (admin-only account
// creation per your call earlier), so this is deliberately simpler than
// the old app's login+register pair.
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { ApiError } from '../apiClient'

export default function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) {
      setError('Please enter your email and password.')
      return
    }
    setSubmitting(true)
    try {
      await login(email.trim(), password)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">
          <svg width="228" height="48" viewBox="0 0 228 48" fill="none">
            <path d="M0 4H28a20 20 0 0 1 0 40H0V4zM10 13H28a11 11 0 0 1 0 22H10V13z" fill="#E2143C" />
            <text x="50" y="32" fontFamily="IBM Plex Sans,sans-serif" fontWeight="700" fontSize="20" fill="#111">DINTO ELECTRICAL</text>
            <text x="50" y="46" fontFamily="IBM Plex Sans,sans-serif" fontWeight="400" fontSize="11" fill="#666">CONTRACTORS, INC.</text>
          </svg>
        </div>
        <div className="login-sub">MANPOWER TRACKER</div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@dinto.com"
            />
          </div>
          <div className="login-field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="btn-signin" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="login-footnote">
          Need an account? Contact an administrator.
        </div>
      </div>
    </div>
  )
}
