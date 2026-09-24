// Job Board — card-per-job grid with trade filters, name search, and
// drag-and-drop crew reassignment. Replaces the old Dashboard as the
// landing page. Reuses the same shared assignment logic as Roster/Jobs
// (utils/assignmentActions.js) so drag-drop behaves identically everywhere.
import { useState, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useData } from '../contexts/DataContext'
import { currentJobId } from '../utils/lookups'
import { isAdmin as checkAdmin, isPm } from '../utils/permissions'
import { moveWorkerToJob, removeWorkerFromJob } from '../utils/assignmentActions'
import { ApiError } from '../apiClient'
import JobModal from '../components/modals/JobModal'

const TRADE_FILTERS = [
  { id: 'All', label: 'All' },
  { id: 'General Foreman', label: 'GF' },
  { id: 'Foreman', label: 'F' },
  { id: 'Subforeman', label: 'SF' },
  { id: 'Journeyman', label: 'JW' },
  { id: 'Apprentice', label: 'A' },
  { id: 'Master Electrician', label: 'ME' },
]

const TRADE_ABBR = { 'General Foreman': 'GF', Foreman: 'F', Subforeman: 'SF', Journeyman: 'JW', Apprentice: 'A', 'Master Electrician': 'ME' }
const TRADE_COLOR = { 'General Foreman': '#B86A00', Foreman: '#0E8A7C', Subforeman: '#6D4AED', Journeyman: '#2563C9', Apprentice: '#71717a', 'Master Electrician': '#16a34a' }

const YARD = { id: 'YARD', name: 'Yard / Unassigned', number: '', location: '', color: '#a1a1aa' }

export default function JobBoardPage() {
  const { user, isAdmin } = useAuth()
  const { data, loading, refresh } = useData()
  const { jobs, workers, assignments, requests } = data

  const [search, setSearch] = useState('')
  const [tradeFilter, setTradeFilter] = useState('All')
  const [jobModal, setJobModal] = useState(null) // null | 'new'
  const [dragWorkerId, setDragWorkerId] = useState(null)
  const [dragOverJobId, setDragOverJobId] = useState(null)
  const [error, setError] = useState('')

  const canDrag = isPm(user)

  const pendingWorkerIds = useMemo(
    () => new Set(requests.filter((r) => r.status === 'Pending' && r.requestType === 'person').map((r) => r.workerId)),
    [requests]
  )

  const boardJobs = useMemo(() => [...jobs, YARD], [jobs])

  const cards = useMemo(() => {
    const q = search.trim().toLowerCase()
    return boardJobs.map((job) => {
      let crew = workers.filter((w) => currentJobId(w, assignments) === job.id)
      if (tradeFilter !== 'All') crew = crew.filter((w) => w.tradeClass === tradeFilter)
      if (q) crew = crew.filter((w) => w.name.toLowerCase().includes(q))
      return { job, crew }
    })
  }, [boardJobs, workers, assignments, tradeFilter, search])

  function handleDragStart(workerId) {
    if (!canDrag) return
    setDragWorkerId(workerId)
    setError('')
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

    setError('')
    try {
      if (targetJobId === 'YARD') {
        if (fromJobId !== 'YARD') await removeWorkerFromJob(worker.id, fromJobId, assignments)
      } else {
        await moveWorkerToJob(worker.id, targetJobId)
      }
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong moving that worker.')
    }
  }

  if (loading && jobs.length === 0) {
    return <div className="screen-loading">Loading…</div>
  }

  return (
    <>
      <div className="board-head">
        <div>
          <div className="board-title">Job Board</div>
          <div className="board-hint">{canDrag ? 'DRAG A NAME TO MOVE A HAND' : 'COMPANY-WIDE CREW VIEW'}</div>
        </div>
        <div className="board-legend">
          <span className="legend-dot-item"><span className="legend-dot" style={{ background: '#2563C9' }} />UPCOMING</span>
        </div>
      </div>

      <div className="board-controls">
        <div className="board-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input
            type="text"
            placeholder="Find a name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="board-trade-tabs">
          {TRADE_FILTERS.map((t) => (
            <button
              key={t.id}
              className={`board-trade-tab${tradeFilter === t.id ? ' active' : ''}`}
              onClick={() => setTradeFilter(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="board-controls-spacer" />
        {checkAdmin(user) && (
          <button className="btn-red" onClick={() => setJobModal('new')}>+ New Project</button>
        )}
      </div>

      {error && <div className="modal-error" style={{ display: 'block', marginBottom: 14 }}>{error}</div>}

      <div className="board-grid">
        {cards.map(({ job, crew }) => (
          <div
            key={job.id}
            className={`board-card${dragOverJobId === job.id ? ' board-card-dragover' : ''}`}
            style={{ borderTopColor: job.color }}
            onDragOver={(e) => { if (canDrag && dragWorkerId) { e.preventDefault(); setDragOverJobId(job.id) } }}
            onDragLeave={() => setDragOverJobId((cur) => (cur === job.id ? null : cur))}
            onDrop={(e) => { e.preventDefault(); handleDrop(job.id) }}
          >
            <div className="board-card-head">
              {job.number ? (
                <span className="board-card-number" style={{ background: `${job.color}1A`, color: job.color }}>{job.number}</span>
              ) : (
                <span className="board-card-number board-card-number-empty">—</span>
              )}
              <span className="board-card-count">{crew.length}</span>
            </div>
            <div className="board-card-name">{job.name}</div>
            {(job.location || job.id !== 'YARD') && (
              <div className="board-card-meta">
                {[job.number && null, job.location].filter(Boolean).join(' \u00b7 ') || '\u00a0'}
              </div>
            )}

            <div className="board-card-crew">
              {crew.length === 0 ? (
                <div className="board-card-empty">No matching crew</div>
              ) : (
                crew.map((w) => {
                  const abbr = TRADE_ABBR[w.tradeClass] || '?'
                  const color = TRADE_COLOR[w.tradeClass] || '#71717a'
                  const upcoming = pendingWorkerIds.has(w.id)
                  return (
                    <div
                      key={w.id}
                      className={`board-worker${canDrag ? ' board-worker-draggable' : ''}${dragWorkerId === w.id ? ' board-worker-dragging' : ''}`}
                      style={{ borderLeftColor: color }}
                      draggable={canDrag}
                      onDragStart={() => handleDragStart(w.id)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="board-worker-avatar" style={{ background: `${color}1A`, color }}>{abbr}</div>
                      <div className="board-worker-info">
                        <div className="board-worker-name">{lastFirst(w.name)}</div>
                        {w.phone && <div className="board-worker-phone">{w.phone}</div>}
                      </div>
                      {upcoming && <span className="board-worker-dot" style={{ background: '#2563C9' }} title="Upcoming request" />}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        ))}
      </div>

      {jobModal && <JobModal onClose={() => setJobModal(null)} />}
    </>
  )
}

function lastFirst(name) {
  const parts = name.trim().split(' ')
  if (parts.length < 2) return name
  const last = parts[parts.length - 1]
  const first = parts[0]
  return `${last}, ${first[0]}`
}
