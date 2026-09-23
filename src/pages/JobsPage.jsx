// Two-panel job management view: job list on the left, crew detail on
// the right. "Remove from job" now closes out the assignment record via
// the API (set end date to yesterday) instead of just deleting it, so
// assignment history is preserved exactly like removeFromJob did before.
import { useState, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useData } from '../contexts/DataContext'
import { accountById } from '../utils/lookups'
import { fmtDateShort, shiftDay, todayStr } from '../utils/dates'
import { isAdmin as checkAdmin, isPm } from '../utils/permissions'
import { api, ApiError } from '../apiClient'
import JobModal from '../components/modals/JobModal'
import AssignWorkerModal from '../components/modals/AssignWorkerModal'

export default function JobsPage() {
  const { user, isAdmin } = useAuth()
  const { data, loading, refresh } = useData()
  const { jobs, workers, assignments, accounts, requests } = data

  const visibleJobs = isAdmin ? jobs : jobs.filter((j) => j.pmId === user.id || j.id === user.jobId)
  const [selectedJobId, setSelectedJobId] = useState(null)
  const selJob = visibleJobs.find((j) => j.id === selectedJobId) || visibleJobs[0] || null

  const [jobModal, setJobModal] = useState(null) // null | 'new' | job object
  const [assignModal, setAssignModal] = useState(null) // null | { jobId }
  const [removeError, setRemoveError] = useState('')

  const pendingWorkerNames = useMemo(
    () => new Set(requests.filter((r) => r.status === 'Pending' && r.requestType === 'person').map((r) => r.workerName)),
    [requests]
  )

  async function handleRemove(workerId, jobId) {
    if (!confirm('Remove this worker from the job? Their assignment history is preserved.')) return
    setRemoveError('')
    const yesterday = shiftDay(todayStr(), -1)
    const active = assignments
      .filter((a) => a.workerId === workerId && a.jobId === jobId)
      .sort((a, b) => (b.startDate > a.startDate ? 1 : -1))
      .find((a) => a.isPermanent || !a.endDate || a.endDate >= todayStr())

    if (!active) return
    try {
      await api.put('/assignments', { id: active.id, isPermanent: false, endDate: yesterday })
      await refresh()
    } catch (err) {
      setRemoveError(err instanceof ApiError ? err.message : 'Something went wrong.')
    }
  }

  if (loading && jobs.length === 0) {
    return <div className="screen-loading">Loading…</div>
  }

  return (
    <>
      <div className="jobs-head">
        <div className="jobs-count">{visibleJobs.length} job{visibleJobs.length !== 1 ? 's' : ''}</div>
        {checkAdmin(user) && (
          <button className="btn-red" onClick={() => setJobModal('new')}>+ New Job</button>
        )}
      </div>

      <div className="jobs-layout">
        <div className="jobs-list">
          {visibleJobs.length === 0 ? (
            <div className="jobs-list-empty">No jobs yet</div>
          ) : (
            visibleJobs.map((j) => {
              const crew = workers.filter((w) => currentJobIdFor(w, assignments) === j.id)
              const pendingCount = requests.filter((r) => (r.fromJobId === j.id || r.toJobId === j.id) && r.status === 'Pending').length
              const active = j.id === selJob?.id
              return (
                <button
                  key={j.id}
                  className={`jobs-list-item${active ? ' active' : ''}`}
                  onClick={() => setSelectedJobId(j.id)}
                >
                  <div className="jobs-list-item-top">
                    <span className="color-dot" style={{ background: j.color }} />
                    <span className="jobs-list-item-name">{j.name}</span>
                    <span className={`job-status-pill${j.status === 'Active' ? ' active' : ''}`}>{j.status}</span>
                  </div>
                  <div className="jobs-list-item-meta">
                    <span className="jobs-list-item-crew">{crew.length} crew</span>
                    {pendingCount > 0 && <span className="badge badge-pending">{pendingCount} pending</span>}
                  </div>
                </button>
              )
            })
          )}
        </div>

        <div className="jobs-detail-panel">
          {!selJob ? (
            <div className="jobs-detail-empty">Select a job to view crew</div>
          ) : (
            <JobDetail
              job={selJob}
              user={user}
              workers={workers}
              assignments={assignments}
              accounts={accounts}
              requests={requests}
              pendingWorkerNames={pendingWorkerNames}
              onAddCrew={() => setAssignModal({ jobId: selJob.id })}
              onEditJob={() => setJobModal(selJob)}
              onRemove={handleRemove}
              removeError={removeError}
            />
          )}
        </div>
      </div>

      {jobModal && (
        <JobModal job={jobModal === 'new' ? null : jobModal} onClose={() => setJobModal(null)} />
      )}
      {assignModal && (
        <AssignWorkerModal presetJobId={assignModal.jobId} onClose={() => setAssignModal(null)} />
      )}
    </>
  )
}

function currentJobIdFor(worker, assignments) {
  const today = todayStr()
  const mine = assignments.filter((a) => a.workerId === worker.id).sort((a, b) => (a.startDate > b.startDate ? -1 : 1))
  for (const a of mine) {
    const endsOk = a.isPermanent || !a.endDate || a.endDate >= today
    if (a.startDate <= today && endsOk) return a.jobId
  }
  if (mine.length) return mine[0].jobId
  return 'YARD'
}

function JobDetail({ job, user, workers, assignments, accounts, requests, pendingWorkerNames, onAddCrew, onEditJob, onRemove, removeError }) {
  const crew = workers.filter((w) => currentJobIdFor(w, assignments) === job.id)
  const pm = accountById(accounts, job.pmId)
  const pendingReqs = requests.filter((r) => (r.fromJobId === job.id || r.toJobId === job.id) && r.status === 'Pending')

  return (
    <>
      <div className="jobs-detail-head">
        <div>
          <div className="jobs-detail-code-row">
            <span className="color-dot" style={{ background: job.color, width: 12, height: 12, borderRadius: 3 }} />
            <span className="jobs-detail-code">{job.number || '\u2014'}</span>
          </div>
          <div className="jobs-detail-name">{job.name}</div>
          {job.phase && <div className="jobs-detail-phase">{job.phase}</div>}
          {job.location && <div className="jobs-detail-location">{job.location}</div>}
        </div>
        <div className="jobs-detail-actions">
          {isPm(user) && <button className="btn-red btn-sm" onClick={onAddCrew}>+ Add Crew</button>}
          {checkAdminInline(user) && <button className="btn-outline btn-sm" onClick={onEditJob}>Edit Job</button>}
        </div>
      </div>

      <div className="jobs-detail-kpis">
        <div className="kpi-card kpi-card-sm">
          <div className="kpi-label">Crew on Site</div>
          <div className="kpi-val-sm">{crew.length}</div>
        </div>
        <div className="kpi-card kpi-card-sm">
          <div className="kpi-label">Project Manager</div>
          <div className="kpi-pm-val" style={{ color: pm ? 'var(--text)' : 'var(--text-muted)' }}>{pm ? pm.name : 'Unassigned'}</div>
        </div>
        <div className="kpi-card kpi-card-sm">
          <div className="kpi-label">Open Requests</div>
          <div className="kpi-val-sm" style={{ color: pendingReqs.length ? 'var(--amber)' : 'var(--text-muted)' }}>{pendingReqs.length}</div>
        </div>
      </div>

      <div className="jobs-detail-crew-head">
        <div className="jobs-detail-crew-label">Current Crew</div>
      </div>
      {removeError && <div className="modal-error" style={{ display: 'block', marginBottom: 10 }}>{removeError}</div>}
      <div className="jobs-crew-list">
        {crew.length === 0 ? (
          <div className="jobs-crew-empty">No crew assigned — use <strong>+ Add Crew</strong> to assign workers</div>
        ) : (
          crew.map((w) => {
            const assign = assignments
              .filter((a) => a.workerId === w.id && a.jobId === job.id)
              .sort((a, b) => (b.startDate > a.startDate ? 1 : -1))[0]
            let status = 'On site'
            if (pendingWorkerNames.has(w.name)) status = 'Requested'
            const since = assign?.startDate ? ` \u00b7 since ${fmtDateShort(assign.startDate)}` : ''
            return (
              <div key={w.id} className="jobs-crew-row">
                <div className="jobs-crew-avatar" style={{ background: job.color }}>{w.initials}</div>
                <div className="jobs-crew-info">
                  <div className="jobs-crew-name">{w.name}</div>
                  <div className="jobs-crew-meta">{w.tradeClass}{since}</div>
                </div>
                <span className={`badge worker-status-${status.toLowerCase().replace(' ', '')}`}>{status.toUpperCase()}</span>
                {isPm(user) && (
                  <button className="btn-ghost btn-xs" onClick={() => onRemove(w.id, job.id)}>Remove</button>
                )}
              </div>
            )
          })
        )}
      </div>
    </>
  )
}

function checkAdminInline(user) {
  return user.role === 'admin'
}
