// Company-wide roster, grouped by current job. Workers are draggable
// (PM/admin only) onto a different job's group to reassign them, or onto
// "Yard / Available" to remove them from their current job — both using
// the shared logic in utils/assignmentActions.js so drag-drop behaves
// identically to the modal-based Assign/Remove actions elsewhere.
import { useState, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useData } from '../contexts/DataContext'
import { currentJobId, jobById } from '../utils/lookups'
import { isAdmin as checkAdmin, isPm } from '../utils/permissions'
import { moveWorkerToJob, removeWorkerFromJob } from '../utils/assignmentActions'
import { ApiError } from '../apiClient'
import WorkerModal from '../components/modals/WorkerModal'
import AssignWorkerModal from '../components/modals/AssignWorkerModal'

export default function RosterPage() {
  const { user } = useAuth()
  const { data, loading, refresh } = useData()
  const { jobs, workers, assignments, requests } = data

  const [workerModal, setWorkerModal] = useState(null) // null | 'new' | worker object
  const [assignModal, setAssignModal] = useState(null) // null | { workerId?, jobId? }
  const [dragWorkerId, setDragWorkerId] = useState(null)
  const [dragOverJobId, setDragOverJobId] = useState(null)
  const [dragError, setDragError] = useState('')

  const canDrag = isPm(user)

  const pendingWorkerNames = useMemo(
    () => new Set(requests.filter((r) => r.status === 'Pending' && r.requestType === 'person').map((r) => r.workerName)),
    [requests]
  )

  const groups = useMemo(() => {
    const order = [...jobs.map((j) => j.id), 'YARD']
    return order
      .map((jobId) => ({
        job: jobById(jobs, jobId),
        people: workers.filter((w) => currentJobId(w, assignments) === jobId),
      }))
      .filter((g) => g.people.length)
  }, [jobs, workers, assignments])

  const onSiteCount = workers.filter((w) => currentJobId(w, assignments) !== 'YARD').length
  const availableCount = workers.filter((w) => currentJobId(w, assignments) === 'YARD').length

  function handleDragStart(workerId) {
    if (!canDrag) return
    setDragWorkerId(workerId)
    setDragError('')
  }

  function handleDragEnd() {
    setDragWorkerId(null)
    setDragOverJobId(null)
  }

  async function handleDrop(targetJobId) {
    setDragOverJobId(null)
    if (!canDrag || !dragWorkerId) return

    const worker = workers.find((w) => w.id === dragWorkerId)
    const fromJobId = worker ? currentJobId(worker, assignments) : null
    setDragWorkerId(null)
    if (!worker || fromJobId === targetJobId) return

    setDragError('')
    try {
      if (targetJobId === 'YARD') {
        if (fromJobId !== 'YARD') await removeWorkerFromJob(worker.id, fromJobId, assignments)
      } else {
        await moveWorkerToJob(worker.id, targetJobId)
      }
      await refresh()
    } catch (err) {
      setDragError(err instanceof ApiError ? err.message : 'Something went wrong moving that worker.')
    }
  }

  if (loading && workers.length === 0) {
    return <div className="screen-loading">Loading…</div>
  }

  return (
    <>
      <div className="roster-head">
        <div className="roster-stats">
          <span className="roster-stat">{workers.length} WORKERS</span>
          <span className="roster-stat roster-stat-green">{onSiteCount} ON SITE</span>
          <span className="roster-stat roster-stat-red">{availableCount} AVAILABLE</span>
        </div>
        <div className="roster-actions">
          {isPm(user) && (
            <button className="btn-outline" onClick={() => setAssignModal({})}>+ Assign to Job</button>
          )}
          {checkAdmin(user) && (
            <button className="btn-red" onClick={() => setWorkerModal('new')}>+ Add Worker</button>
          )}
        </div>
      </div>

      {canDrag && groups.length > 0 && (
        <div className="roster-drag-hint">Drag a worker card onto another job to reassign them.</div>
      )}
      {dragError && <div className="modal-error" style={{ display: 'block', marginBottom: 12 }}>{dragError}</div>}

      {groups.length === 0 ? (
        <div className="empty-state">
          <h3>No workers yet</h3>
          <p>Add workers to the roster to get started.</p>
          {checkAdmin(user) && (
            <button className="btn-red" onClick={() => setWorkerModal('new')}>Add Worker</button>
          )}
        </div>
      ) : (
        groups.map(({ job, people }) => (
          <div
            key={job.id}
            className={`roster-group${dragOverJobId === job.id ? ' roster-group-dragover' : ''}`}
            onDragOver={(e) => { if (canDrag && dragWorkerId) { e.preventDefault(); setDragOverJobId(job.id) } }}
            onDragLeave={() => setDragOverJobId((cur) => (cur === job.id ? null : cur))}
            onDrop={(e) => { e.preventDefault(); handleDrop(job.id) }}
          >
            <div className="roster-group-head">
              <span className="color-dot roster-group-dot" style={{ background: job.color }} />
              <h3 className="roster-group-title">{job.id === 'YARD' ? 'Yard / Available' : job.name}</h3>
              <span className="roster-group-count">{people.length}</span>
              <div className="roster-group-rule" />
              {isPm(user) && (
                <button className="btn-ghost" onClick={() => setAssignModal({ jobId: job.id })}>+ Assign</button>
              )}
            </div>
            <div className="roster-card-grid">
              {people.map((p) => {
                const isAvail = job.id === 'YARD'
                let status = isAvail ? 'Available' : 'On site'
                if (pendingWorkerNames.has(p.name)) status = 'Requested'
                return (
                  <div
                    key={p.id}
                    className={`worker-card${canDrag ? ' worker-card-draggable' : ''}${dragWorkerId === p.id ? ' worker-card-dragging' : ''}`}
                    draggable={canDrag}
                    onDragStart={() => handleDragStart(p.id)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="worker-card-avatar" style={{ background: isAvail ? 'var(--border)' : job.color }}>
                      {p.initials}
                    </div>
                    <div className="worker-card-info">
                      <div className="worker-card-name">{p.name}</div>
                      <span className="worker-card-trade">{p.tradeClass}</span>
                      {p.phone && <div className="worker-card-phone">{p.phone}</div>}
                    </div>
                    <div className="worker-card-actions">
                      <span className={`badge worker-status-${status.toLowerCase().replace(' ', '')}`}>{status.toUpperCase()}</span>
                      {isPm(user) && (
                        <div className="worker-card-btns">
                          <button className="btn-ghost btn-xs" onClick={() => setAssignModal({ workerId: p.id })}>Assign</button>
                          <button className="btn-ghost btn-xs" onClick={() => setWorkerModal(p)}>Edit</button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}

      {workerModal && (
        <WorkerModal
          worker={workerModal === 'new' ? null : workerModal}
          onClose={() => setWorkerModal(null)}
        />
      )}
      {assignModal && (
        <AssignWorkerModal
          presetWorkerId={assignModal.workerId}
          presetJobId={assignModal.jobId}
          onClose={() => setAssignModal(null)}
        />
      )}
    </>
  )
}
