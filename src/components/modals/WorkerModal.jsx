// Add/edit worker. Create is admin-only, edit is admin-or-PM — enforced
// again server-side in workers.js regardless of what this UI allows.
import { useState } from 'react'
import Modal from './Modal'
import { api, ApiError } from '../../apiClient'
import { useData } from '../../contexts/DataContext'

const TRADE_CLASSES = ['General Foreman', 'Foreman', 'Subforeman', 'Journeyman', 'Apprentice', 'Master Electrician']

export default function WorkerModal({ worker, onClose }) {
  const { refresh } = useData()
  const isEdit = !!worker
  const [firstName, setFirstName] = useState(worker?.firstName || '')
  const [lastName, setLastName] = useState(worker?.lastName || '')
  const [tradeClass, setTradeClass] = useState(worker?.tradeClass || 'Journeyman')
  const [phone, setPhone] = useState(worker?.phone || '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setError('')
    if (!firstName.trim()) {
      setError('First name is required.')
      return
    }
    setSaving(true)
    try {
      const payload = { firstName: firstName.trim(), lastName: lastName.trim(), tradeClass, phone: phone.trim() }
      if (isEdit) {
        await api.put('/workers', { id: worker.id, ...payload })
      } else {
        await api.post('/workers', payload)
      }
      await refresh()
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={isEdit ? 'Edit Worker' : 'Add Worker'}
      onClose={onClose}
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-red" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Worker'}
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
        <label className="form-label">Trade Class</label>
        <select className="form-select" value={tradeClass} onChange={(e) => setTradeClass(e.target.value)}>
          {TRADE_CLASSES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label className="form-label">Phone</label>
        <input className="form-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 000-0000" />
      </div>
      {error && <div className="modal-error" style={{ display: 'block' }}>{error}</div>}
    </Modal>
  )
}
