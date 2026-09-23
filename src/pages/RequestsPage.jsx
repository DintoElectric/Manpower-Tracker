// Request list + detail view, with approve/deny actions. Reads ?new=1
// and ?id=... from the URL (set by Dashboard's links) to auto-open the
// New Request modal or auto-select a specific request.
import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useData } from '../contexts/DataContext'
import { jobById, accountById } from '../utils/lookups'
import { fmtDate, daysDiff } from '../utils/dates'
import { canApproveRequest, canEditRequest, canDeleteRequest, viewerDirection, isPm } from '../utils/permissions'
import { api, ApiError } from '../apiClient'
import RequestModal from '../components/modals/RequestModal'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'in', label: 'Incoming' },
  { id: 'out', label: 'Outgoing' },
  { id: 'pending', label: 'Pending' },
]

export default function RequestsPage() {
  const { user, isAdmin } = useAuth()
  const { data, refresh } = useData()
  const { jobs, accounts, requests } = data
  const [searchParams, setSearchParams] = useSearchParams()

  const [tab, setTab] = useState('all')
  const [selectedId, setSelectedId] = useState(searchParams.get('id') || null)
  const [modalOpen, setModalOpen] = useState(searchParams.get('new') === '1')
  const [editingRequest, setEditingRequest] = useState(null)
  const [actionError, setActionError] = useState('')

  // Clear the one-shot URL params after reading them, so a later refresh
  // doesn't keep forcing the modal open or re-selecting an old request.
  useEffect(() => {
    if (searchParams.get('new') || searchParams.get('id')) {
      setSearchParams({}, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const myJobId = user.jobId
  const visible = useMemo(
    () => (isAdmin ? requests : requests.filter((r) => r.fromJobId === myJobId || r.toJobId === myJobId)),
    [requests, isAdmin, myJobId]
  )

  const filtered = useMemo(() => {
    if (tab === 'all') return visible
    if (tab === 'in') return visible.filter((r) => viewerDirection(user, r) === 'in')
    if (tab === 'out') return visible.filter((r) => viewerDirection(user, r) === 'out')
    if (tab === 'pending') return visible.filter((r) => r.status === 'Pending')
    return visible
  }, [visible, tab, user])

  const selected = filtered.find((r) => r.id === selectedId) || filtered[0] || null

  async function handleResolve(action) {
    setActionError('')
    try {
      await api.put('/requests', { id: selected.id, action })
      await refresh()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Something went wrong.')
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this request? This cannot be undone.')) return
    setActionError('')
    try {
      await api.del('/requests', { id: selected.id })
      setSelectedId(null)
      await refresh()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Something went wrong.')
    }
  }

  return (
    <>
      <div className="requests-head">
        <div className="tab-group">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab-btn${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {isPm(user) && (
          <button className="btn-red" onClick={() => { setEditingRequest(null); setModalOpen(true) }}>
            + New Request
          </button>
        )}
      </div>

      <div className="requests-layout">
        <div className="requests-list">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <h3>No requests</h3>
              <p>No manpower requests match this filter.</p>
            </div>
          ) : (
            filtered.map((r) => {
              const fromJ = jobById(jobs, r.fromJobId)
              const toJ = jobById(jobs, r.toJobId)
              const dir = viewerDirection(user, r)
              return (
                <button
                  key={r.id}
                  className={`req-card${selected?.id === r.id ? ' selected' : ''}`}
                  onClick={() => setSelectedId(r.id)}
                >
                  <div className="req-card-top">
                    <span className={`badge badge-${dir}`}>{dir === 'in' ? 'INCOMING' : 'OUTGOING'}</span>
                    <span className={`badge badge-${r.status.toLowerCase()}`}>{r.status}</span>
                  </div>
                  <div className="req-card-subject">
                    {r.requestType === 'person' ? r.workerName : `${r.qty} \u00d7 ${r.roleRequested}`}
                  </div>
                  <div className="req-card-meta">
                    {r.requestType === 'person' ? r.workerRole : `Role request \u00b7 ${r.isPermanent ? 'permanent' : 'temporary'}`}
                  </div>
                  <div className="req-card-route">
                    <span className="req-card-route-text">{fromJ.shortName || fromJ.name} &rarr; {toJ.shortName || toJ.name}</span>
                    <span className={`badge badge-${r.priority.toLowerCase()}`}>{r.priority}</span>
                  </div>
                  <div className="req-card-date">{fmtSubmittedAt(r.submittedAt)}</div>
                </button>
              )
            })
          )}
        </div>

        <div>
          {!selected ? (
            <div className="detail-pane detail-empty">Select a request to view details</div>
          ) : (
            <RequestDetail
              request={selected}
              user={user}
              jobs={jobs}
              accounts={accounts}
              onApprove={() => handleResolve('approve')}
              onDeny={() => handleResolve('deny')}
              onEdit={() => { setEditingRequest(selected); setModalOpen(true) }}
              onDelete={handleDelete}
              isAdmin={isAdmin}
              error={actionError}
            />
          )}
        </div>
      </div>

      {modalOpen && (
        <RequestModal
          request={editingRequest}
          onClose={() => { setModalOpen(false); setEditingRequest(null) }}
        />
      )}
    </>
  )
}

function fmtSubmittedAt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function RequestDetail({ request: sel, user, jobs, accounts, onApprove, onDeny, onEdit, onDelete, isAdmin, error }) {
  const fromJ = jobById(jobs, sel.fromJobId)
  const toJ = jobById(jobs, sel.toJobId)
  const counterAcc = accountById(accounts, sel.counterPmId)
  const submitter = accountById(accounts, sel.submittedBy)
  const dir = viewerDirection(user, sel)

  const canApprove = canApproveRequest(user, sel)
  const canEdit = canEditRequest(user, sel)
  const canDelete = canDeleteRequest(user, sel)

  const dateStr = sel.isPermanent ? 'Permanent transfer' : `${fmtDate(sel.startDate)} \u2013 ${fmtDate(sel.endDate)}`
  const durDays = !sel.isPermanent && sel.startDate && sel.endDate ? `${daysDiff(sel.startDate, sel.endDate)} calendar days` : 'No end date'

  return (
    <div className="detail-pane">
      <div className="detail-badges">
        <span className={`badge badge-${dir}`}>{dir === 'in' ? 'INCOMING' : 'OUTGOING'}</span>
        <span className={`badge badge-${sel.status.toLowerCase()}`}>{sel.status}</span>
        <span className={`badge badge-${sel.priority.toLowerCase()}`} style={{ marginLeft: 'auto' }}>{sel.priority}</span>
      </div>
      <div className="detail-subject">{sel.requestType === 'person' ? sel.workerName : `${sel.qty} \u00d7 ${sel.roleRequested}`}</div>
      <div className="detail-subject-meta">
        {sel.requestType === 'person' ? sel.workerRole : `Role request \u00b7 ${sel.isPermanent ? 'permanent' : 'temporary'}`}
      </div>

      <div className="detail-grid">
        <div className="detail-field"><div className="detail-label">Releasing Job</div><div className="detail-val">{fromJ.name}</div><div className="detail-sub">{accountById(accounts, fromJ.pmId)?.name || '—'}</div></div>
        <div className="detail-field"><div className="detail-label">Receiving Job</div><div className="detail-val">{toJ.name}</div><div className="detail-sub">{accountById(accounts, toJ.pmId)?.name || '—'}</div></div>
        <div className="detail-field"><div className="detail-label">Duration</div><div className="detail-val">{dateStr}</div><div className="detail-sub">{durDays}</div></div>
        <div className="detail-field"><div className="detail-label">Submitted</div><div className="detail-val">{fmtSubmittedAt(sel.submittedAt)}</div><div className="detail-sub">{submitter?.name || '—'}</div></div>
        {counterAcc && (
          <div className="detail-field" style={{ gridColumn: 'span 2' }}>
            <div className="detail-label">Counter PM</div>
            <div className="detail-val">{counterAcc.name}</div>
          </div>
        )}
      </div>

      {sel.note && (
        <div className="detail-note">
          <div className="detail-label">Note</div>
          <div className="detail-note-text">{sel.note}</div>
        </div>
      )}

      {error && <div className="modal-error" style={{ display: 'block', marginTop: 12 }}>{error}</div>}

      <div className="detail-actions">
        {canApprove && (
          <>
            <button className="btn-red" style={{ flex: 1 }} onClick={onApprove}>Approve Release</button>
            <button className="btn-outline" style={{ flex: 1 }} onClick={onDeny}>Deny</button>
          </>
        )}
        {canEdit && <button className="btn-outline" onClick={onEdit}>Edit</button>}
        {canDelete && isAdmin && <button className="btn-ghost" style={{ color: 'var(--text-faint)' }} onClick={onDelete}>Delete</button>}
        {sel.status !== 'Pending' && (
          <div className="detail-resolved-note">
            {sel.status === 'Approved' ? 'Approved — crew movement scheduled' : `Denied by ${counterAcc?.name || 'PM'}`}
          </div>
        )}
      </div>
    </div>
  )
}
