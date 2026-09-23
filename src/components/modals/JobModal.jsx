// Add/edit job. Admin-only for both create and edit, enforced again
// server-side in jobs.js.
import { useState } from 'react'
import Modal from './Modal'
import { api, ApiError } from '../../apiClient'
import { useData } from '../../contexts/DataContext'

const COLORS = [
  { value: '#E2123C', label: 'Dinto Red' },
  { value: '#0E8A7C', label: 'Teal' },
  { value: '#B86A00', label: 'Amber' },
  { value: '#2563C9', label: 'Blue' },
  { value: '#6D4AED', label: 'Purple' },
  { value: '#16a34a', label: 'Green' },
  { value: '#a1a1aa', label: 'Gray' },
]

export default function JobModal({ job, onClose }) {
  const { data, refresh } = useData()
  const { accounts } = data
  const isEdit = !!job

  const [name, setName] = useState(job?.name || '')
  const [shortName, setShortName] = useState(job?.shortName || '')
  const [number, setNumber] = useState(job?.number || '')
  const [location, setLocation] = useState(job?.location || '')
  const [phase, setPhase] = useState(job?.phase || '')
  const [status, setStatus] = useState(job?.status || 'Active')
  const [pmId, setPmId] = useState(job?.pmId || '')
  const [color, setColor] = useState(job?.color || '#E2123C')
  const [startDate, setStartDate] = useState(job?.startDate || '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const pmOptions = accounts.filter((a) => a.role === 'pm' || a.role === 'admin')

  async function handleSave() {
    setError('')
    if (!name.trim()) {
      setError('Job name is required.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        shortName: shortName.trim(),
        number: number.trim(),
        location: location.trim(),
        phase: phase.trim(),
        status,
        pmId: pmId || null,
        color,
        startDate: startDate || null,
      }
      if (isEdit) {
        await api.put('/jobs', { id: job.id, ...payload })
      } else {
        await api.post('/jobs', payload)
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
      title={isEdit ? 'Edit Job' : 'New Job'}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-red" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Job'}
          </button>
        </>
      }
    >
      <div className="form-row">
        <div className="form-field">
          <label className="form-label">Job Name *</label>
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Riverside Medical Center" />
        </div>
        <div className="form-field">
          <label className="form-label">Short Name</label>
          <input className="form-input" value={shortName} onChange={(e) => setShortName(e.target.value)} placeholder="e.g. Riverside Medical" />
        </div>
      </div>
      <div className="form-row">
        <div className="form-field">
          <label className="form-label">Job Code</label>
          <input className="form-input" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="e.g. RMC" />
        </div>
        <div className="form-field">
          <label className="form-label">Location</label>
          <input className="form-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, State" />
        </div>
      </div>
      <div className="form-row">
        <div className="form-field">
          <label className="form-label">Phase / Area</label>
          <input className="form-input" value={phase} onChange={(e) => setPhase(e.target.value)} placeholder="e.g. Phase 2 — Bldg C" />
        </div>
        <div className="form-field">
          <label className="form-label">Status</label>
          <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option>Active</option><option>Bidding</option><option>On Hold</option><option>Complete</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-field">
          <label className="form-label">Assigned PM</label>
          <select className="form-select" value={pmId} onChange={(e) => setPmId(e.target.value)}>
            <option value="">— No PM —</option>
            {pmOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label className="form-label">Color</label>
          <select className="form-select" value={color} onChange={(e) => setColor(e.target.value)}>
            {COLORS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>
      <div className="form-field">
        <label className="form-label">Start Date</label>
        <input className="form-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </div>
      {error && <div className="modal-error" style={{ display: 'block' }}>{error}</div>}
    </Modal>
  )
}
