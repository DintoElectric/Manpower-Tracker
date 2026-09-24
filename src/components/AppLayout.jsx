import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { DataProvider, useData } from '../contexts/DataContext'

const NAV_ITEMS = [
  { path: '/board', label: 'Job Board', roles: ['admin', 'pm', 'foreman'], icon: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z' },
  { path: '/schedule', label: 'Schedule', roles: ['admin', 'pm', 'foreman'], icon: 'M3 4h18v18H3zM16 2v4M8 2v4M3 10h18' },
  { path: '/requests', label: 'Requests', roles: ['admin', 'pm'], icon: 'M4 9h16M16 5l4 4-4 4M20 15H4M8 11l-4 4 4 4' },
  { path: '/roster', label: 'Roster', roles: ['admin', 'pm', 'foreman'], icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z' },
  { path: '/jobs', label: 'Jobs', roles: ['admin', 'pm'], icon: 'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z' },
  { path: '/accounts', label: 'Accounts', roles: ['admin'], icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM19 8v4M21 6l2 2M21 6l-2 2' },
]

const TITLES = {
  '/board': ['Job Board', 'COMPANY-WIDE CREW VIEW'],
  '/schedule': ['Crew Schedule', 'WHERE EVERY HAND IS'],
  '/requests': ['Manpower Requests', 'PM-TO-PM CREW TRANSFERS'],
  '/roster': ['Company Roster', 'ALL FIELD PERSONNEL'],
  '/jobs': ['Jobs', 'ACTIVE JOB SITES'],
  '/accounts': ['Accounts', 'USER MANAGEMENT'],
}

function initials(name) {
  return (name || '').split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

function NavIcon({ d }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d={d} />
    </svg>
  )
}

function SyncStatus() {
  const { loading, error } = useData()
  if (error) {
    return <span className="sync-status sync-error">Offline — retrying…</span>
  }
  return (
    <span className="sync-status">
      <span className={`live-dot${loading ? ' live-dot-loading' : ''}`} />
      {loading ? 'Syncing…' : 'Live'}
    </span>
  )
}

function Sidebar({ items }) {
  return (
    <nav className="rail">
      <div className="rail-logo">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <path d="M0 0H16a14 14 0 0 1 0 28H0V0zM6 6H16a8 8 0 0 1 0 16H6V6z" fill="#E2143C" />
        </svg>
        <div className="rail-logo-text">Manpower<br />Tracker</div>
      </div>
      <div className="rail-nav">
        {items.map((n) => (
          <NavLink key={n.path} to={n.path} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <NavIcon d={n.icon} />
            {n.label}
          </NavLink>
        ))}
      </div>
      <UserFooter />
    </nav>
  )
}

function UserFooter() {
  const { user, logout } = useAuth()
  const roleLabel = { admin: 'ADMIN', pm: 'PROJECT MGR', foreman: 'FOREMAN' }[user.role] || user.role.toUpperCase()
  return (
    <div className="rail-user">
      <div className="user-avatar">{initials(user.name)}</div>
      <div className="user-info">
        <div className="user-name">{user.name}</div>
        <div className="user-role">{roleLabel}</div>
      </div>
      <button className="btn-logout" onClick={logout} title="Sign out">
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>
    </div>
  )
}

function MobileNav({ items }) {
  return (
    <nav className="mobile-nav">
      {items.slice(0, 5).map((n) => (
        <NavLink key={n.path} to={n.path} className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}>
          <NavIcon d={n.icon} />
          {n.label}
        </NavLink>
      ))}
    </nav>
  )
}

function Topbar() {
  const { user } = useAuth()
  const location = useLocation()
  const [title, sub] = TITLES[location.pathname] || ['', '']
  const roleLabel = { admin: 'ADMINISTRATOR', pm: 'PROJECT MGR', foreman: 'FOREMAN' }[user.role] || user.role.toUpperCase()

  return (
    <div className="topbar">
      <div className="topbar-titles">
        <h1 className="screen-title">{title}</h1>
        <span className="topbar-sub">{sub}</span>
      </div>
      <div className="topbar-spacer" />
      <SyncStatus />
      <div className="topbar-user">
        <div style={{ textAlign: 'right' }}>
          <div className="topbar-user-name">{user.name}</div>
          <div className="topbar-user-role">{roleLabel}</div>
        </div>
        <div className="topbar-avatar">{initials(user.name)}</div>
      </div>
    </div>
  )
}

export default function AppLayout({ children }) {
  const { user } = useAuth()
  const items = NAV_ITEMS.filter((n) => n.roles.includes(user.role))

  return (
    <DataProvider>
      <div className="app-shell">
        <Sidebar items={items} />
        <div className="main-col">
          <Topbar />
          <div className="screen">{children}</div>
        </div>
        <MobileNav items={items} />
      </div>
    </DataProvider>
  )
}
