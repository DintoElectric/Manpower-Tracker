// Real date helpers — this replaces the old hardcoded TODAY_DT = 2026-06-26.
// Everything here reads the actual current date, so the schedule/Gantt view
// is always centered on "now" instead of a frozen demo date.

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Today at midnight local time, as a Date object — use this instead of `new Date()`
// directly anywhere comparisons need to ignore time-of-day.
export function todayDate() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// Today as 'YYYY-MM-DD', matching how dates are stored/compared everywhere else.
export function todayStr() {
  return todayDate().toISOString().slice(0, 10)
}

export function parseDate(str) {
  return new Date(str + 'T00:00:00')
}

export function fmtDate(str) {
  if (!str) return '—'
  const [y, m, d] = str.split('-')
  return `${MONTHS_SHORT[parseInt(m) - 1]} ${parseInt(d)}, ${y}`
}

export function fmtDateShort(str) {
  if (!str) return ''
  const [y, m, d] = str.split('-')
  return `${MONTHS_SHORT[parseInt(m) - 1]} ${parseInt(d)}`
}

export function daysDiff(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000) + 1
}

export function shiftDay(str, delta) {
  const d = parseDate(str)
  d.setDate(d.getDate() + delta)
  return d.toISOString().slice(0, 10)
}

export function addMonths(date, n) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + n)
  return d
}

// Schedule/Gantt range: always a rolling window centered on today, instead
// of the old app's fixed Feb–Jul 2026 range. Defaults to 2 months back,
// 4 months forward — tune freely once you see it rendered.
export function scheduleRange() {
  const start = addMonths(todayDate(), -2)
  start.setDate(1)
  const end = addMonths(todayDate(), 4)
  return { start, end }
}

export { MONTHS_SHORT }
