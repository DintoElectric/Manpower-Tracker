// Renders the crew timeline: workers grouped by trade class, with colored
// bars showing which job they're assigned to over time. The date range is
// a rolling window centered on today (see scheduleRange in utils/dates.js)
// instead of the old app's frozen Feb–Jul 2026 range.
import { todayDate, scheduleRange, MONTHS_SHORT } from '../../utils/dates'
import { currentJobId, jobById } from '../../utils/lookups'

const DAY_MS = 86400000
const PX_PER_DAY = { Day: 18, Week: 6.2, Month: 2.4 }
const ROLE_ORDER = ['General Foreman', 'Foreman', 'Subforeman', 'Journeyman', 'Apprentice', 'Master Electrician']

export default function GanttChart({ zoom, workers, jobs, assignments }) {
  const { start: rangeStart, end: rangeEnd } = scheduleRange()
  const ppd = PX_PER_DAY[zoom]
  const width = Math.ceil((rangeEnd - rangeStart) / DAY_MS * ppd)
  const today = todayDate()
  const todayX = Math.round((today - rangeStart) / DAY_MS * ppd)

  const months = []
  let mc = new Date(rangeStart)
  mc.setDate(1)
  while (mc <= rangeEnd) {
    months.push({
      label: `${MONTHS_SHORT[mc.getMonth()].toUpperCase()} '${String(mc.getFullYear()).slice(2)}`,
      x: Math.round((mc - rangeStart) / DAY_MS * ppd),
    })
    mc = new Date(mc.getFullYear(), mc.getMonth() + 1, 1)
  }

  const weeks = []
  if (zoom !== 'Month') {
    let w = new Date(rangeStart)
    while (w <= rangeEnd) {
      const wx = Math.round((w - rangeStart) / DAY_MS * ppd)
      if (wx > 0) weeks.push(wx)
      w = new Date(w.getTime() + 7 * DAY_MS)
    }
  }

  const groups = ROLE_ORDER
    .map((role) => ({ role, people: workers.filter((w) => w.tradeClass === role) }))
    .filter((g) => g.people.length)

  if (!groups.length) return null

  const gridOverlay = (
    <div className="gantt-grid-overlay">
      {months.map((m, i) => i > 0 && <div key={m.x} className="gantt-month-line" style={{ left: m.x }} />)}
      {weeks.map((wx) => <div key={wx} className="gantt-week-line" style={{ left: wx }} />)}
      <div className="gantt-today-line" style={{ left: todayX }} />
    </div>
  )

  return (
    <div className="gantt-wrap">
      <div className="gantt-inner">
        <div className="gantt-labels">
          <div className="gantt-corner"><span className="gantt-corner-label">CREW / ROLE</span></div>
          {groups.map((g) => (
            <div key={g.role}>
              <div className="gantt-group-row">
                <span className="gantt-group-role">{g.role}</span>
                <span className="gantt-group-count">{g.people.length}</span>
              </div>
              {g.people.map((p) => {
                const cjId = currentJobId(p, assignments)
                const j = jobById(jobs, cjId)
                return (
                  <div key={p.id} className="gantt-person-row">
                    <span className="color-dot" style={{ background: j.color }} />
                    <div className="gantt-person-info">
                      <div className="gantt-person-name">{p.name}</div>
                      <div className="gantt-person-job">{cjId === 'YARD' ? 'AVAILABLE' : (j.number || cjId)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="gantt-timeline" style={{ width }}>
          <div className="gantt-timeline-header">
            {months.map((m) => (
              <span key={m.x} className="gantt-month-label" style={{ left: m.x + 5 }}>{m.label}</span>
            ))}
            <div className="gantt-today-flag" style={{ left: todayX }}>
              TODAY &middot; {MONTHS_SHORT[today.getMonth()].toUpperCase()} {today.getDate()}
            </div>
          </div>

          {groups.map((g) => (
            <div key={g.role}>
              <div className="gantt-timeline-group-row">{gridOverlay}</div>
              {g.people.map((p) => (
                <PersonRow
                  key={p.id}
                  worker={p}
                  jobs={jobs}
                  assignments={assignments.filter((a) => a.workerId === p.id)}
                  rangeStart={rangeStart}
                  rangeEnd={rangeEnd}
                  ppd={ppd}
                  width={width}
                  todayX={todayX}
                  gridOverlay={gridOverlay}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PersonRow({ assignments, jobs, rangeStart, rangeEnd, ppd, width, todayX, gridOverlay }) {
  const sorted = assignments.slice().sort((a, b) => (a.startDate < b.startDate ? -1 : 1))

  return (
    <div className="gantt-timeline-person-row">
      {gridOverlay}
      {sorted.map((a) => {
        const jj = jobById(jobs, a.jobId)
        const sd = new Date(a.startDate + 'T00:00:00')
        const ed = a.isPermanent ? rangeEnd : new Date((a.endDate || rangeEnd.toISOString().slice(0, 10)) + 'T00:00:00')
        const x0 = Math.max(0, Math.round((sd - rangeStart) / DAY_MS * ppd))
        const x1 = Math.min(width, Math.round((ed - rangeStart) / DAY_MS * ppd))

        const bars = []
        const solidEnd = Math.min(x1, todayX)
        if (x0 < solidEnd) {
          bars.push(
            <div key="solid" className="gantt-bar gantt-bar-solid" style={{ left: x0, width: solidEnd - x0, background: jj.color }}>
              {solidEnd - x0 > 36 && <span className="gantt-bar-label">{jj.number || a.jobId}</span>}
            </div>
          )
        }
        const projStart = Math.max(x0, todayX)
        if (projStart < x1) {
          bars.push(
            <div
              key="projected"
              className="gantt-bar gantt-bar-projected"
              style={{
                left: projStart,
                width: x1 - projStart,
                borderColor: jj.color,
                background: `repeating-linear-gradient(45deg, ${jj.color}22 0 4px, ${jj.color}08 4px 8px)`,
              }}
            >
              {x1 - projStart > 36 && <span className="gantt-bar-label" style={{ color: jj.color }}>{jj.number || a.jobId}</span>}
            </div>
          )
        }
        return bars
      })}
    </div>
  )
}
