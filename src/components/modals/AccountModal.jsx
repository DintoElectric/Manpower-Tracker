// Add/edit user account. Admin-only end to end — enforced again
// server-side in accounts.js. Password field is optional on edit
// (leave blank to keep the current password).
import { useState } from 'react'
import Modal from './Modal'
import { api, ApiError } from '../../apiClient'
import { useData } from '../../contexts/DataContext'
import { useAuth } from '../../contexts/AuthContext'

export default function AccountModal({ account, onClose }) {
  const { user: me } = useAuth()
  const { data, refresh } = useData()
  const { jobs } = data
  const isEdit = !!account

  const [firstName, setFirstName] = useState(account?.firstName || '')
  const [lastName, setLastName] = useState(account?.lastName || '')
  const [email, setEmail] = useState(account?.email || '')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [role, setRole] = useState(account?.role || 'pm')
  const [jobId, setJobId] = useState(account?.jobId || '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setError('')
    if (!firstName.trim() || !lastName.trim()) return setError('Full name is required.')
    if (!email.trim()) return setError('Email is required.')
    if (!isEdit && password.length < 6) return setError('Password must be at least 6 characters.')
    if (password && password !== password2) return setError('Passwords do not match.')

    setSaving(true)
    try {
      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        role,
        jobId: jobId || null,
        ...(password ? { password } : {}),
      }
      if (isEdit) {
        await api.put('/accounts', { id: account.id, ...payload })
      } else {
        await api.post('/accounts', payload)
      }
      await refresh()
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  const lockedToAdmin = isEdit && account.id === me.id && account.role === 'admin'

  return (
    <Modal
      title={isEdit ? 'Edit Account' : 'Add Account'}
      onClose={onClose}
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-red" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Account'}
          </button>
        </>
      }
    >
      <div className="form-row">
        <div className="form-field">
          <label className="form-label">First Name *</label>
          <input className="form-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First" />
        </div>
        <div className="form-field">
          <label className="form-label">Last Name *</label>
          <input className="form-input" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last" />
        </div>
      </div>
      <div className="form-field">
        <label className="form-label">Email *</label>
        <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@dinto.com" />
      </div>
      <div className="form-field">
        <label className="form-label">{isEdit ? 'New Password (leave blank to keep)' : 'Password *'}</label>
        <input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isEdit ? '' : 'At least 6 characters'} />
      </div>
      {password && (
        <div className="form-field">
          <label className="form-label">Confirm Password</label>
          <input className="form-input" type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="Repeat password" />
        </div>
      )}
      <div className="form-field">
        <label className="form-label">Role</label>
        <select className="form-select" value={role} onChange={(e) => setRole(e.target.value)} disabled={lockedToAdmin}>
          <option value="admin">Admin</option>
          <option value="pm">Project Manager</option>
          <option value="foreman">Foreman</option>
        </select>
        {lockedToAdmin && <div className="form-hint">This is your own account and the only admin — role is locked to prevent lockout.</div>}
      </div>
      <div className="form-field">
        <label className="form-label">Home Job (PM/Foreman)</label>
        <select className="form-select" value={jobId} onChange={(e) => setJobId(e.target.value)}>
          <option value="">— No specific job —</option>
          {jobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
        </select>
      </div>
      {error && <div className="modal-error" style={{ display: 'block' }}>{error}</div>}
    </Modal>
  )
}
