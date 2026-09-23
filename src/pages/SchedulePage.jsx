import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useData } from '../contexts/DataContext'
import GanttChart from '../components/schedule/GanttChart'
import { isPm } from '../utils/permissions'

const ZOOM_LEVELS = ['Day', 'Week', 'Month']

export default function SchedulePage() {
  const { user } = useAuth()
  const { data, loading } = useData()
  const [zoom, setZoom] = useState('Week')
  const [assignModalOpen, setAssignModalOpen] = useState(false)

  const { jobs, workers, assignments } = data
  const hasWorkers = workers.length > 0

  if (loading && workers.length === 0) {
    return <div className="screen-loading">Loading…</div>
  }

  return (
    <>
      <div className="schedule-head">
        <div>
          <div className="schedule-title">Crew Timeline</div>
          <div className="schedule-subtitle">
            {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} &middot; ROLLING WINDOW
          </div>
        </div>
        <div className="schedule-controls">
          <div className="schedule-legend">
            <span className="legend-item"><span className="legend-swatch legend-solid" /> ASSIGNED</span>
            <span className="legend-item"><span className="legend-swatch legend-dashed" /> PROJECTED</span>
          </div>
          <div className="zoom-toggle">
            {ZOOM_LEVELS.map((z) => (
              <button
                key={z}
                className={`zoom-btn${zoom === z ? ' active' : ''}`}
                onClick={() => setZoom(z)}
              >
                {z}
              </button>
            ))}
          </div>
          {isPm(user) && (
            <button className="btn-red btn-sm" onClick={() => setAssignModalOpen(true)}>+ Assign</button>
          )}
        </div>
      </div>

      {hasWorkers ? (
        <GanttChart zoom={zoom} workers={workers} jobs={jobs} assignments={assignments} />
      ) : (
        <div className="empty-state">
          <h3>No workers yet</h3>
          <p>Add workers to the roster to see their schedule here.</p>
        </div>
      )}

      {/* AssignWorkerModal wires in once the shared modals are built */}
    </>
  )
}
