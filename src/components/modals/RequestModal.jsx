// New/edit manpower request. Handles the "am I requesting FROM another
// job or releasing TO another job" direction toggle, person-vs-role
// request type, and auto-suggesting the counter PM from whichever job
// is on the other side of the transfer.
import { useState, useEffect } from 'react'
import Modal from './Modal'
import { api, ApiError } from '../../apiClient'
import { useAuth } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import { todayStr } from '../../utils/dates'

const TRADE_CLASSES = ['General Foreman', 'Foreman', 'Subforeman', 'Journeyman', 'Apprentice']
const PRIORITIES = ['Urgent', 'High', 'Normal', 'Low']

export default function RequestModal({ request, onClose }) {
  const { user } = useAuth()
  const { data, refresh } = useData()
  const { workers, jobs, accounts } = data
  const isEdit = !!request
  const myJobId = user.jobId || jobs[0]?.id || ''

  // 'requesting' = my job RECEIVES crew from another job.
  // 'releasing'  = my job RELEASES crew TO another job.
  const [intent, setIntent] = useState('requesting')
  const [type, setType] = useState(request?.requestType || 'person')
  const [workerId, setWorkerId] = useState(request?.workerId || workers[0]?.id || '')
  const [role, setRole] = useState(request?.roleRequested || 'Journeyman')
  const [qty, setQty] = useState(request?.qty || 1)
  const [fromJobId, setFromJobId] = useState(request?.fromJobId || myJobId)
  const [toJobId, setToJobId] = useState(request?.toJobId || '')
  const [counterPmId, setCounterPmId] = useState(request?.counterPmId || '')
  const [isPermanent, setIsPermanent] = useState(request?.isPermanent || false)
  const [startDate, setStartDate] = useState(request?.startDate || todayStr())
  const [endDate, setEndDate] = useState(request?.endDate || '')
  const [priority, setPriority] = useState(request?.priority || 'Normal')
  const [note, setNote] = useState(request?.note || '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [counterTouched, setCounterTouched] = useState(false)

  // Keep my job pinned to the correct side as intent changes (only for new requests)
  useEffect(() => {
    if (isEdit) return
    if (intent === 'requesting') setToJobId(myJobId)
    else setFromJobId(myJobId)
  }, [intent, myJobId, isEdit])

  // Auto-suggest counter PM from whichever job is on the other side
  useEffect(() => {
    if (counterTouched) return
    const otherJobId = intent === 'requesting' ? fromJobId : toJobId
    const otherJob = jobs.find((j) => j.id === otherJobId)
    if (otherJob?.pmId) setCounterPmId(otherJob.pmId)
  }, [intent, fromJobId, toJobId, jobs, counterTouched])

  const fromLabel = intent === 'requesting' ? 'Releasing Job (has the worker)' : 'Your Job (releasing)'
  const toLabel = intent === 'requesting' ? 'Your Job (receiving)' : 'Receiving Job (needs the worker)'
  const pmOptions = accounts.filter((a) => a.role === 'pm' || a.role === 'admin')

  async function handleSave() {
    setError('')
    if (!fromJobId || !toJobId) return setError('Please select both jobs.')
    if (fromJobId === toJobId) return setError('From and To jobs must be different.')
    if (type === 'person' && !workerId) return setError('Please select a worker.')

    setSaving(true)
    try {
      const payload = {
        requestType: type,
        workerId: type === 'person' ? workerId : null,
        roleRequested: type === 'role' ? role : '',
        qty: type === 'role' ? Math.max(1, parseInt(qty) || 1) : 1,
        fromJobId,
        toJobId,
        counterPmId: counterPmId || null,
        isPermanent,
        startDate: isPermanent ? null : startDate,
        endDate: isPermanent ? null : (endDate || null),
        priority,
        note: note.trim(),
      }
      if (isEdit) {
        await api.put('/requests', { id: request.id, ...payload })
      } else {
        await api.post('/requests', payload)
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
      title={isEdit ? 'Edit Request' : 'New Manpower Request'}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-red" onClick={handleSave} disabled={saving}>
            {saving ? 'Submitting…' : isEdit ? 'Save Changes' : 'Submit Request'}
          </button>
        </>
      }
    >
      {!isEdit && (
        <div className="form-row">
          <div className="form-field">
            <label className="form-label">What are you doing?</label>
            <select className="form-select" value={intent} onChange={(e) => setIntent(e.target.value)}>
              <option value="requesting">Requesting crew FROM another job</option>
              <option value="releasing">Releasing crew TO another job</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Request Type</label>
            <select className="form-select" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="person">Specific Person</option>
              <option value="role">By Role / Count</option>
            </select>
          </div>
        </div>
      )}

      {type === 'person' ? (
        <div className="form-field">
          <label className="form-label">Worker</label>
          <select className="form-select" value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
            {workers.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.tradeClass})</option>)}
          </select>
        </div>
      ) : (
        <div className="form-row">
          <div className="form-field">
            <label className="form-label">Trade Class</label>
            <select className="form-select" value={role} onChange={(e) => setRole(e.target.value)}>
              {TRADE_CLASSES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Quantity</label>
            <input className="form-input" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
        </div>
      )}

      <div className="form-row">
        <div className="form-field">
          <label className="form-label">{fromLabel}</label>
          <select className="form-select" value={fromJobId} onChange={(e) => setFromJobId(e.target.value)}>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label className="form-label">{toLabel}</label>
          <select className="form-select" value={toJobId} onChange={(e) => setToJobId(e.target.value)}>
            <option value="">— Select job —</option>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-field">
          <label className="form-label">Counter PM</label>
          <select
            className="form-select"
            value={counterPmId}
            onChange={(e) => { setCounterPmId(e.target.value); setCounterTouched(true) }}
          >
            <option value="">— Select PM —</option>
            {pmOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label className="form-label">Priority</label>
          <select className="form-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
            {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div className="form-field">
        <label className="form-label">Duration</label>
        <select className="form-select" value={isPermanent ? '1' : '0'} onChange={(e) => setIsPermanent(e.target.value === '1')}>
          <option value="0">Temporary — set dates</option>
          <option value="1">Permanent transfer</option>
        </select>
      </div>

      {!isPermanent && (
        <div className="form-row">
          <div className="form-field">
            <label className="form-label">Start Date</label>
            <input className="form-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="form-field">
            <label className="form-label">End Date</label>
            <input className="form-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
      )}

      <div className="form-field">
        <label className="form-label">Note / Justification</label>
        <textarea className="form-textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Explain why this crew movement is needed…" />
      </div>

      {error && <div className="modal-error" style={{ display: 'block' }}>{error}</div>}
    </Modal>
  )
}
