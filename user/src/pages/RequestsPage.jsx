import { useState, useEffect } from 'react'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import './RequestsPage.css'

const STATUS_OPTS = [
  { v: 'P', l: 'Present' },
  { v: 'A', l: 'Absent' },
  { v: 'PP', l: 'Double Shift' },
]

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtDate(d) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function RequestsPage() {
  const [tab, setTab] = useState('new')
  const [mine, setMine] = useState([])
  const [loadingMine, setLoadingMine] = useState(true)

  function loadMine() {
    setLoadingMine(true)
    api.get('/requests/mine').then(r => setMine(r.data)).catch(() => {}).finally(() => setLoadingMine(false))
  }
  useEffect(() => { loadMine() }, [])

  async function cancelRequest(id) {
    try {
      await api.delete(`/requests/${id}`)
      toast.success('Request cancelled')
      loadMine()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to cancel') }
  }

  return (
    <div className="fade-in">
      <div className="req-tabs mb-2">
        <button className={`req-tab ${tab === 'new' ? 'active' : ''}`} onClick={() => setTab('new')}>New Request</button>
        <button className={`req-tab ${tab === 'mine' ? 'active' : ''}`} onClick={() => setTab('mine')}>My Requests</button>
      </div>

      {tab === 'new' ? (
        <NewRequestForm onSubmitted={() => { setTab('mine'); loadMine() }} />
      ) : (
        <MyRequests list={mine} loading={loadingMine} onCancel={cancelRequest} />
      )}
    </div>
  )
}

function NewRequestForm({ onSubmitted }) {
  const [type, setType] = useState('correction')
  const [busy, setBusy] = useState(false)

  // Correction fields
  const [date, setDate] = useState(todayISO())
  const [reqIn, setReqIn] = useState('')
  const [reqOut, setReqOut] = useState('')
  const [reqStatus, setReqStatus] = useState('P')

  // Leave fields
  const [leaveKind, setLeaveKind] = useState('full')
  const [startDate, setStartDate] = useState(todayISO())
  const [endDate, setEndDate] = useState(todayISO())
  const [session, setSession] = useState('first')

  const [reason, setReason] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!reason.trim()) { toast.error('Please provide a reason'); return }
    setBusy(true)
    try {
      const body = type === 'correction'
        ? { type, date, requestedClockIn: reqIn, requestedClockOut: reqOut, requestedStatus: reqStatus, reason }
        : { type, leaveKind, startDate, endDate: leaveKind === 'half' ? startDate : endDate, halfDaySession: session, reason }
      await api.post('/requests', body)
      toast.success('Request submitted')
      setReason(''); setReqIn(''); setReqOut('')
      onSubmitted()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to submit request') }
    finally { setBusy(false) }
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="form-group">
        <label className="label">Request Type</label>
        <div className="req-type-toggle">
          <button type="button" className={`req-type-btn ${type === 'correction' ? 'active' : ''}`} onClick={() => setType('correction')}>
            Missed Clock-In/Out
          </button>
          <button type="button" className={`req-type-btn ${type === 'leave' ? 'active' : ''}`} onClick={() => setType('leave')}>
            Leave Application
          </button>
        </div>
      </div>

      {type === 'correction' ? (
        <>
          <div className="form-group">
            <label className="label">Date</label>
            <input className="input" type="date" max={todayISO()} value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="label">Clock In time</label>
              <input className="input" type="time" value={reqIn} onChange={e => setReqIn(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label">Clock Out time</label>
              <input className="input" type="time" value={reqOut} onChange={e => setReqOut(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="label">Correct status for this day</label>
            <select className="input" value={reqStatus} onChange={e => setReqStatus(e.target.value)}>
              {STATUS_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
        </>
      ) : (
        <>
          <div className="form-group">
            <label className="label">Leave Type</label>
            <div className="req-type-toggle">
              <button type="button" className={`req-type-btn ${leaveKind === 'full' ? 'active' : ''}`} onClick={() => setLeaveKind('full')}>
                Full-Day
              </button>
              <button type="button" className={`req-type-btn ${leaveKind === 'half' ? 'active' : ''}`} onClick={() => setLeaveKind('half')}>
                Half-Day
              </button>
            </div>
          </div>

          {leaveKind === 'half' ? (
            <>
              <div className="form-group">
                <label className="label">Date</label>
                <input className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="label">Session</label>
                <div className="req-type-toggle">
                  <button type="button" className={`req-type-btn ${session === 'first' ? 'active' : ''}`} onClick={() => setSession('first')}>First Half</button>
                  <button type="button" className={`req-type-btn ${session === 'second' ? 'active' : ''}`} onClick={() => setSession('second')}>Second Half</button>
                </div>
              </div>
            </>
          ) : (
            <div className="form-row">
              <div className="form-group">
                <label className="label">Start Date</label>
                <input className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="label">End Date</label>
                <input className="input" type="date" min={startDate} value={endDate} onChange={e => setEndDate(e.target.value)} required />
              </div>
            </div>
          )}
        </>
      )}

      <div className="form-group">
        <label className="label">Reason</label>
        <textarea className="input" rows={3} placeholder="Explain your request..." value={reason} onChange={e => setReason(e.target.value)} required />
      </div>

      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
        {busy ? <span className="spinner" /> : 'Submit Request'}
      </button>
    </form>
  )
}

function MyRequests({ list, loading, onCancel }) {
  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}><span className="spinner" /></div>
  if (list.length === 0) return <div className="card text-sm text-2" style={{ textAlign: 'center' }}>You haven't submitted any requests yet.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.65rem' }}>
      {list.map(r => (
        <div key={r.id} className="card">
          <div className="flex items-center justify-between mb-1">
            <span className={`req-type-badge ${r.type}`}>{r.type === 'leave' ? 'Leave' : 'Correction'}</span>
            <span className={`req-status-badge ${r.status}`}>{r.status}</span>
          </div>
          {r.type === 'correction' ? (
            <div className="text-sm">{fmtDate(r.date)}{r.requestedStatus ? ` — ${r.requestedStatus}` : ''}</div>
          ) : (
            <div className="text-sm">
              {r.leaveKind === 'half'
                ? `${fmtDate(r.startDate)} (${r.halfDaySession === 'first' ? 'First Half' : 'Second Half'})`
                : (r.startDate === r.endDate ? fmtDate(r.startDate) : `${fmtDate(r.startDate)} → ${fmtDate(r.endDate)}`)}
            </div>
          )}
          <div className="text-xs text-2 mt-1" style={{ fontStyle: 'italic' }}>"{r.reason}"</div>
            {r.status === 'pending' && (
            <button className="btn btn-secondary btn-block mt-2" onClick={() => onCancel(r.id)}>Cancel Request</button>
          )}
        </div>
      ))}
    </div>
  )
}
