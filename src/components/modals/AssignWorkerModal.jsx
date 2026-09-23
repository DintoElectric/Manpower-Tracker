// Assigns a worker to a job. Accepts optional presetWorkerId/presetJobId
// so it can be opened from different entry points (Roster's per-person
// "Assign" button, Jobs' "+ Add Crew" button, or the generic Schedule
// "+ Assign" button) while sharing one form.
import { useState } from 'react'
import Modal from './Modal'
import { api, ApiError } from '../../apiClient'
import { useData } from '../../contexts/DataContext'
import { currentJobId, jobById } from '../../utils/lookups'
import { todayStr } from '../../utils/dates'

export default function AssignWorkerModal({ presetWorkerId, presetJobId, onClose }) {
  const { data, refresh } = useData()
  const { workers, jobs, assignments } = data

  const [workerId, setWorkerId] = useState(presetWorkerId || workers[0]?.id || '')
  const [jobId, setJobId] = useState(presetJobId || jobs[0]?.id || '')
  const [startDate, setStartDate] = useState(todayStr())
  const [isPermanent, setIsPermanent] = useState(false)
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setError('')
    if (!workerId || !jobId || !startDate) {
      setError('Worker, job, and start date are required.')
      return
    }
    setSaving(true)
    try {
      await api.post('/assignments', {
        workerId,
        jobId,
        startDate,
        isPermanent,
        endDate: isPermanent ? null : (endDate || null),
      })
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
      title="Assign Worker to Job"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-red" onClick={handleSave} disabled={saving}>
            {saving ? 'Assigning…' : 'Assign'}
          </button>
        </>
      }
    >
      <div className="form-field">
        <label className="form-label">Worker</label>
        <select className="form-select" value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
          {workers.map((w) => {
            const cj = currentJobId(w, assignments)
            const onThis = jobId && cj === jobId
            const label = onThis
              ? `${w.name} (${w.tradeClass}) — already here`
              : cj !== 'YARD'
                ? `${w.name} (${w.tradeClass}) — on ${jobById(jobs, cj).name}`
                : `${w.name} (${w.tradeClass})`
            return <option key={w.id} value={w.id}>{label}</option>
          })}
        </select>
      </div>
      <div className="form-field">
        <label className="form-label">Job</label>
        <select className="form-select" value={jobId} onChange={(e) => setJobId(e.target.value)}>
          {jobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label className="form-label">Start Date *</label>
        <input className="form-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </div>
      <div className="form-field">
        <label className="form-label">Duration</label>
        <select className="form-select" value={isPermanent ? '1' : '0'} onChange={(e) => setIsPermanent(e.target.value === '1')}>
          <option value="0">Temporary — set end date</option>
          <option value="1">Permanent / Ongoing</option>
        </select>
      </div>
      {!isPermanent && (
        <div className="form-field">
          <label className="form-label">End Date</label>
          <input className="form-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      )}
      {error && <div className="modal-error" style={{ display: 'block' }}>{error}</div>}
    </Modal>
  )
}
