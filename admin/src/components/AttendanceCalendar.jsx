import { useState, useEffect, useCallback } from 'react'
import api from '../utils/api'
import { toast } from './Toaster'
import './AttendanceCalendar.css'

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// Exported so EmployeeCard can read today's status without a separate fetch
export function getTodayKey() {
  const now = new Date()
  return String(now.getDate()).padStart(2, '0')
}

export default function AttendanceCalendar({ employeeId, adminMode = false, onTodayStatus }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [data, setData] = useState({})
  const [holidays, setHolidays] = useState([])
  const [loading, setLoading] = useState(true)
  const [markModal, setMarkModal] = useState(null)
  const [savingDay, setSavingDay] = useState(null) // which day is being saved

  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()

  // Full load — only on mount or month change
  const load = useCallback(async () => {
    if (!employeeId) return
    setLoading(true)
    try {
      const [attRes, holRes] = await Promise.all([
        api.get(`/attendance/${employeeId}/${monthStr}`),
        api.get('/holidays')
      ])
      const newData = attRes.data
      setData(newData)
      setHolidays(holRes.data)
      // Notify parent of today's status (only when viewing current month)
      if (onTodayStatus && isCurrentMonth) {
        const todayKey = getTodayKey()
        onTodayStatus(newData[todayKey]?.status || null)
      }
    } catch (e) { console.error('Calendar load error', e) }
    finally { setLoading(false) }
  }, [employeeId, monthStr])

  useEffect(() => { load() }, [load])

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()
  const holidayDates = new Set(
    holidays
      .filter(h => h.date && h.date.split('T')[0].startsWith(monthStr))
      .map(h => h.date.split('T')[0].split('-')[2])
  )
  const canGoNext = new Date(year, month + 1, 1) <= today

  function prevMonth() { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  function nextMonth() { if (!canGoNext) return; if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1) }

  function getDayMeta(d) {
    const dayStr = String(d).padStart(2, '0')
    const rec = data[dayStr]
    const status = rec?.status
    const remark = rec?.remark || ''
    const isHol = holidayDates.has(dayStr)
    const isFut = new Date(year, month, d) > today
    const isToday = new Date(year, month, d).toDateString() === today.toDateString()
    let cls = ''
    if (isHol && !status) cls = 'H'
    else if (isFut) cls = 'future'
    else if (status) cls = status
    else if (isToday) cls = 'today'
    return { cls, remark, status, isFut, isToday }
  }

  // ── SEAMLESS single-day patch ──────────────────────────────
  async function markAttendance(day, status, remark) {
    const dayStr = String(day).padStart(2, '0')
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${dayStr}`
    setSavingDay(day)
    try {
      await api.post('/attendance', { employeeId, date: dateStr, status, remark })
      // Patch just this day in local state — no full reload
      setData(prev => ({ ...prev, [dayStr]: { status, remark } }))
      if (onTodayStatus && isCurrentMonth && dayStr === getTodayKey()) {
        onTodayStatus(status)
      }
      toast.success('Saved')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed')
    } finally {
      setSavingDay(null)
    }
  }

  async function clearAttendance(day) {
    const dayStr = String(day).padStart(2, '0')
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${dayStr}`
    setSavingDay(day)
    try {
      await api.delete(`/attendance/${employeeId}/${dateStr}`)
      // Remove just this day from local state
      setData(prev => {
        const next = { ...prev }
        delete next[dayStr]
        return next
      })
      if (onTodayStatus && isCurrentMonth && dayStr === getTodayKey()) {
        onTodayStatus(null)
      }
      toast.success('Cleared')
    } catch {
      toast.error('Clear failed')
    } finally {
      setSavingDay(null)
    }
  }

  function handleDayClick(d) {
    if (!adminMode) return
    const { isFut } = getDayMeta(d)
    if (isFut) return
    const dayStr = String(d).padStart(2, '0')
    setMarkModal({ day: d, existing: data[dayStr] })
  }

  const P = Object.values(data).filter(v => v.status === 'P').length
  const A = Object.values(data).filter(v => v.status === 'A').length
  const PP = Object.values(data).filter(v => v.status === 'PP').length

  return (
    <div>
      <div className="cal-nav">
        <button className="btn btn-secondary btn-sm" onClick={prevMonth}>&#8249;</button>
        <span className="cal-nav-title">{MONTHS[month]} {year}</span>
        <button className="btn btn-secondary btn-sm" onClick={nextMonth} disabled={!canGoNext}>&#8250;</button>
      </div>

      <div className="stat-strip mb-2">
        {/* <button
          className="stat-chip stat-btn"
          disabled={!adminMode || savingDay}
          onClick={() => {
            const today = new Date().getDate()
            setMarkModal({
              day: today,
              existing: data[getTodayKey()]
            })
          }}
        >
          <span className="badge badge-P">P</span>
          <span>{P}</span>
        </button> */}

        <button
          className="stat-chip stat-btn badge-P"
          disabled={!adminMode || savingDay}
          onClick={() => {
            const today = new Date().getDate()
            markAttendance(today, 'P', data[getTodayKey()]?.remark || '')
          }}
        >
          {/* <span className="badge badge-P">P</span> */}
          P
        </button>

        <button
          className="stat-chip stat-btn badge-A"
          disabled={!adminMode || savingDay}
          onClick={() => {
            const today = new Date().getDate()
            markAttendance(today, 'A', data[getTodayKey()]?.remark || '')
          }}
        >
          {/* <span className="badge badge-A">A</span> */}
          A
        </button>

        <button
          className="stat-chip stat-btn badge-PP"
          disabled={!adminMode || savingDay}
          onClick={() => {
            const today = new Date().getDate()
            markAttendance(today, 'PP', data[getTodayKey()]?.remark || '')
          }}
        >
          {/* <span className="badge badge-PP">PP</span> */}
          PP
        </button>

        {PP > 0 && (
          <div className="stat-chip">
            Total Present : {P + PP * 2}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '1.25rem' }}><span className="spinner" /></div>
      ) : (
        <div className="cal-grid">
          {DAYS.map(d => <div key={d} className="cal-head">{d}</div>)}
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1
            const { cls, remark, isFut } = getDayMeta(d)
            const clickable = adminMode && !isFut
            const saving = savingDay === d
            return (
              <div key={d}
                className={`cal-day ${cls} ${clickable ? 'clickable' : ''} ${saving ? 'cal-day-saving' : ''}`}
                onClick={() => handleDayClick(d)}
                title={remark || undefined}>
                {saving ? <span className="cal-mini-spinner" /> : d}
                {remark && !isFut && <span className="remark-dot" />}
              </div>
            )
          })}
        </div>
      )}

      {/* Legend for calendar */}
      <div className="flex gap-2 mt-2" style={{ flexWrap: 'wrap', fontSize: '.73rem' }}>
        {[{ c: 'P', l: 'Present' }, { c: 'A', l: 'Absent' }, { c: 'PP', l: 'Double' }, { c: 'H', l: 'Holiday' }].map(s => (
          <span key={s.c} className="flex items-center gap-1">
            <span className={`cal-day ${s.c}`} style={{ width: 14, height: 14, fontSize: 9, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.c}</span>
            {s.l}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warn)', display: 'inline-block', flexShrink: 0 }} />
          Remark
        </span>
      </div>

      {markModal && (
        <MarkModal
          day={markModal.day}
          existing={markModal.existing}
          onClose={() => setMarkModal(null)}
          onMark={(status, remark) => { setMarkModal(null); markAttendance(markModal.day, status, remark) }}
          onDelete={() => { setMarkModal(null); clearAttendance(markModal.day) }}
        />
      )}
    </div>
  )
}

function MarkModal({ day, existing, onClose, onMark, onDelete }) {
  const [status, setStatus] = useState(existing?.status || 'P')
  const [remark, setRemark] = useState(existing?.remark || '')

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Mark Day {day}</h2>
        <div className="form-group">
          <label className="label">Status</label>
          <div className="flex gap-1">
            {[{ c: 'P', l: 'Present' }, { c: 'A', l: 'Absent' }, { c: 'PP', l: 'Double' }].map(s => (
              <button key={s.c} type="button"
                className={`btn btn-sm ${status === s.c ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1 }}
                onClick={() => setStatus(s.c)}>{s.l}</button>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="label">Remark / Advance (optional)</label>
          <input className="input" placeholder="e.g. Advance 500 or Late arrival..." value={remark} onChange={e => setRemark(e.target.value)} />
          <div className="text-xs text-2 mt-1">Remarks appear as a dot on the calendar and in CSV report</div>
        </div>
        <div className="flex gap-1 mt-2">
          {existing && <button className="btn btn-danger btn-sm" onClick={onDelete}>Clear</button>}
          <div style={{ flex: 1 }} />
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onMark(status, remark)}>Save</button>
        </div>
      </div>
    </div>
  )
}
