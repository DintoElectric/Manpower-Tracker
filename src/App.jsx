// Top-level routing + the auth gate. Shows a brief "verifying session"
// state while AuthContext checks /api/auth-session, then either the
// login screen or the main app shell — no flash of the login screen for
// someone who's already signed in.
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import AppLayout from './components/AppLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import SchedulePage from './pages/SchedulePage'
import RequestsPage from './pages/RequestsPage'
import RosterPage from './pages/RosterPage'
import JobsPage from './pages/JobsPage'
import AccountsPage from './pages/AccountsPage'

export default function App() {
  const { checking, isLoggedIn, isAdmin } = useAuth()

  if (checking) {
    return (
      <div className="boot-screen">
        <div className="boot-spinner" aria-label="Loading" />
      </div>
    )
  }

  if (!isLoggedIn) {
    return <LoginPage />
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/requests" element={<RequestsPage />} />
        <Route path="/roster" element={<RosterPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route
          path="/accounts"
          element={isAdmin ? <AccountsPage /> : <Navigate to="/dashboard" replace />}
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppLayout>
  )
}
