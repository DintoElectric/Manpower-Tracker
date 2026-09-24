import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import AppLayout from './components/AppLayout'
import LoginPage from './pages/LoginPage'
import JobBoardPage from './pages/JobBoardPage'
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
        <Route path="/" element={<Navigate to="/board" replace />} />
        <Route path="/dashboard" element={<Navigate to="/board" replace />} />
        <Route path="/board" element={<JobBoardPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/requests" element={<RequestsPage />} />
        <Route path="/roster" element={<RosterPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route
          path="/accounts"
          element={isAdmin ? <AccountsPage /> : <Navigate to="/board" replace />}
        />
        <Route path="*" element={<Navigate to="/board" replace />} />
      </Routes>
    </AppLayout>
  )
}
