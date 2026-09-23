// User account management. Admin-only (also guarded at the router level
// in App.jsx and enforced server-side in accounts.js) — this page assumes
// it's only ever rendered for an admin.
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useData } from '../contexts/DataContext'
import { jobById } from '../utils/lookups'
import { api, ApiError } from '../apiClient'
import AccountModal from '../components/modals/AccountModal'

function initials(name) {
  return (name || '').split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function AccountsPage() {
  const { user: me } = useAuth()
  const { data, loading, refresh } = useData()
  const { accounts, jobs } = data

  const [accountModal, setAccountModal] = useState(null) // null | 'new' | account object
  const [error, setError] = useState('')

  async function handleDelete(id) {
    if (id === me.id) return
    if (!confirm('Remove this account? They will no longer be able to sign in.')) return
    setError('')
    try {
      await api.del('/accounts', { id })
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.')
    }
  }

  if (loading && accounts.length === 0) {
    return <div className="screen-loading">Loading…</div>
  }

  return (
    <>
      <div className="accounts-head">
        <div className="accounts-count">{accounts.length} accounts</div>
        <button className="btn-red" onClick={() => setAccountModal('new')}>+ Add Account</button>
      </div>

      {error && <div className="modal-error" style={{ display: 'block', marginBottom: 12 }}>{error}</div>}

      <div className="panel">
        <table className="data-table">
          <thead>
            <tr><th>Name / Email</th><th>Role</th><th>Home Job</th><th></th></tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr><td colSpan={4} className="table-empty">No accounts</td></tr>
            ) : (
              accounts.map((a) => {
                const isSelf = a.id === me.id
                return (
                  <tr key={a.id}>
                    <td>
                      <div className="account-row">
                        <div className="account-avatar">{initials(a.name)}</div>
                        <div>
                          <div className="account-name">
                            {a.name}
                            {isSelf && <span className="account-you-tag">YOU</span>}
                          </div>
                          <div className="account-email">{a.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`badge badge-${a.role}`}>{a.role.toUpperCase()}</span></td>
                    <td>{a.jobId ? jobById(jobs, a.jobId)?.name : '—'}</td>
                    <td>
                      <div className="account-actions">
                        <button className="btn-ghost" onClick={() => setAccountModal(a)}>Edit</button>
                        {!isSelf && (
                          <button className="btn-ghost" style={{ color: 'var(--text-faint)' }} onClick={() => handleDelete(a.id)}>
                            Remove
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {accountModal && (
        <AccountModal
          account={accountModal === 'new' ? null : accountModal}
          onClose={() => setAccountModal(null)}
        />
      )}
    </>
  )
}
