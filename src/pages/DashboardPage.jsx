import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useData } from '../contexts/DataContext'
import { currentJobId, jobById, accountById } from '../utils/lookups'
import { isPm } from '../utils/permissions'

export default function DashboardPage() {
  const { user, isAdmin } = useAuth()
  const { data, loading } = useData()
  const { jobs, workers, assignments, requests, accounts } = data

  const stats = useMemo(() => {
    const onSite = workers.filter((w) => currentJobId(w, assignments) !== 'YARD').length
    const myJobId = user.jobId
    const myRequests = isAdmin ? requests : requests.filter((r) => r.fromJobId === myJobId || r.toJobId === myJobId)
    const pending = (isAdmin ? requests : myRequests).filter((r) => r.status === 'Pending').length
    const activeJobs = jobs.filter((j) => j.status === 'Active').length
    return { onSite, pending, activeJobs, myRequests }
  }, [workers, assignments, requests, jobs, user, isAdmin])

  const myJobs = isAdmin ? jobs : jobs.filter((j) => j.id === user.jobId)

  const recentRequests = useMemo(
    () => stats.myRequests.slice().sort((a, b) => (b.submittedAt > a.submittedAt ? 1 : -1)).slice(0, 5),
    [stats.myRequests]
  )

  if (loading && jobs.length === 0) {
    return <div className="screen-loading">Loading…</div>
  }

  return (
    <>
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Workers</div>
          <div className="kpi-val">{workers.length}</div>
          <div className="kpi-sub">{stats.onSite} on site today</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Open Requests</div>
          <div className="kpi-val" style={{ color: 'var(--amber)' }}>{stats.pending}</div>
          <div className="kpi-sub">Pending approval</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Active Jobs</div>
          <div className="kpi-val">{stats.activeJobs}</div>
          <div className="kpi-sub">{jobs.length} total jobs</div>
        </div>
        {isPm(user) && !isAdmin && (
          <Link to="/requests?new=1" className="kpi-card kpi-card-action">
            <div className="kpi-label">Quick Action</div>
            <div className="kpi-action-text">+ New Request</div>
            <div className="kpi-sub">Submit manpower request</div>
          </Link>
        )}
      </div>

      {myJobs.length > 0 && (
        <div className="dash-section">
          <div className="dash-section-title">MY JOBS</div>
          <div className="job-card-grid">
            {myJobs.map((j) => {
              const crew = workers.filter((w) => currentJobId(w, assignments) === j.id)
              const pm = accountById(accounts, j.pmId)
              return (
                <div key={j.id} className="kpi-card job-card">
                  <div className="job-card-head">
                    <span className="color-dot" style={{ background: j.color }} />
                    <span className="job-card-number">{j.number || j.id}</span>
                    <span className={`job-status-pill${j.status === 'Active' ? ' active' : ''}`}>{j.status}</span>
                  </div>
                  <div className="job-card-name">{j.name}</div>
                  {j.phase && <div className="job-card-phase">{j.phase}</div>}
                  <div className="job-card-crew">
                    <span className="job-card-crew-count">{crew.length}</span>
                    <span className="job-card-crew-label">ON SITE</span>
                  </div>
                  {pm && <div className="job-card-pm">PM: {pm.name}</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Recent Requests</span>
          {isPm(user) && (
            <Link to="/requests?new=1" className="btn-red btn-sm">+ New Request</Link>
          )}
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Dir</th><th>Subject</th><th>Route</th><th>Priority</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {recentRequests.length === 0 ? (
                <tr><td colSpan={6} className="table-empty">No requests yet</td></tr>
              ) : (
                recentRequests.map((r) => {
                  const fromJ = jobById(jobs, r.fromJobId)
                  const toJ = jobById(jobs, r.toJobId)
                  const dir = r.submittedBy === user.id ? 'out' : 'in'
                  return (
                    <tr key={r.id}>
                      <td><span className={`badge badge-${dir}`}>{dir === 'in' ? 'IN' : 'OUT'}</span></td>
                      <td className="cell-strong">{r.requestType === 'person' ? r.workerName : `${r.qty} x ${r.roleRequested}`}</td>
                      <td className="cell-muted">{fromJ.shortName || fromJ.name} &#x2192; {toJ.shortName || toJ.name}</td>
                      <td><span className={`badge badge-${r.priority.toLowerCase()}`}>{r.priority}</span></td>
                      <td><span className={`badge badge-${r.status.toLowerCase()}`}>{r.status}</span></td>
                      <td><Link to={`/requests?id=${r.id}`} className="btn-ghost">View</Link></td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
