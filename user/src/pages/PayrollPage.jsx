import { useState, useEffect, useCallback } from 'react'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import { PayrollSkeleton } from '../components/Skeleton'
import './PayrollPage.css'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function fmtMoney(n) {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`
}

// Four separate boxes rather than one text input — reads clearly as "this
// is a short numeric PIN", not a password field, and auto-advances so it's
// quick to enter on a phone keyboard.
function PinBoxes({ value, onChange, autoFocus, disabled, idPrefix = 'pinbox', onComplete }) {
  const digits = value.split('')
  function setDigit(i, d) {
    const next = value.split('')
    next[i] = d
    const joined = next.join('').slice(0, 4)
    onChange(joined)
    if (joined.length === 4 && onComplete) {
      onComplete(joined)
    }
    if (d && i < 3) {
      const el = document.getElementById(`${idPrefix}-${i + 1}`)
      el?.focus()
    }
  }
  function handleKeyDown(i, e) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      document.getElementById(`${idPrefix}-${i - 1}`)?.focus()
    }
  }
  return (
    <div className="flex items-center gap-2" style={{ justifyContent: 'center' }}>
      {[0, 1, 2, 3].map(i => (
        <input
          key={i}
          id={`${idPrefix}-${i}`}
          className="input"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          autoFocus={autoFocus && i === 0}
          disabled={disabled}
          value={digits[i] || ''}
          onChange={e => setDigit(i, e.target.value.replace(/\D/g, '').slice(-1))}
          onKeyDown={e => handleKeyDown(i, e)}
          style={{ width: 46, height: 52, textAlign: 'center', fontSize: '1.3rem', fontWeight: 700, letterSpacing: 0 }}
        />
      ))}
    </div>
  )
}

function SetupPin({ onDone }) {
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (pin.length !== 4)  { setError('Enter a 4-digit PIN'); return }
    if (pin !== confirmPin) { setError('PINs do not match'); return }
    setBusy(true); setError('')
    try {
      await api.post('/employees/payroll-pin/setup', { pin, confirmPin })
      toast.success('PIN created')
      onDone()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create PIN')
    } finally { setBusy(false) }
  }

  return (
    <div className="card fade-in" style={{ textAlign: 'center' }}>
      <div className="font-700 mb-1" style={{ fontSize: '1.05rem' }}>Secure your Payroll</div>
      <p className="text-sm text-2 mb-2">Create a 4-digit PIN. You'll need it every time you want to view your salary details.</p>

      <form onSubmit={submit}>
        <div className="mb-2">
          <div className="text-xs text-2 mb-1">Choose a PIN</div>
          <PinBoxes idPrefix="choose-pin" value={pin} onChange={setPin} autoFocus disabled={busy} />
        </div>
        <div className="mb-2">
          <div className="text-xs text-2 mb-1">Confirm PIN</div>
          <PinBoxes idPrefix="confirm-pin" value={confirmPin} onChange={setConfirmPin} disabled={busy} />
        </div>
        {error && <div className="text-xs" style={{ color: 'var(--danger)', marginBottom: '.8rem' }}>{error}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? <span className="spinner" /> : 'Create PIN'}
        </button>
      </form>
    </div>
  )
}

function VerifyPin({ onDone }) {
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function verifyPin(pinValue) {
    setBusy(true); setError('')
    try {
      await api.post('/employees/payroll-pin/verify', { pin: pinValue })
      onDone()
    } catch (err) {
      setError(err.response?.data?.error || 'Incorrect PIN')
      setPin('')
    } finally { setBusy(false) }
  }

  async function submit(e) {
    e?.preventDefault()
    if (pin.length !== 4) { setError('Enter your 4-digit PIN'); return }
    await verifyPin(pin)
  }

  return (
    <div className="card fade-in" style={{ textAlign: 'center' }}>
      <div className="font-700 mb-1" style={{ fontSize: '1.05rem' }}>Enter your Payroll PIN</div>
      <p className="text-sm text-2 mb-2">For your privacy, this is required every time.</p>
      <form onSubmit={submit}>
        <PinBoxes idPrefix="verify-pin" value={pin} onChange={setPin} autoFocus disabled={busy} onComplete={async pinValue => {
          if (!busy) await verifyPin(pinValue)
        }} />
        {error && <div className="text-xs" style={{ color: 'var(--danger)', margin: '.8rem 0' }}>{error}</div>}
        {busy && <div style={{ marginTop: '1rem' }}><span className="spinner" /></div>}
      </form>
    </div>
  )
}

function PayrollView() {
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth()) // 0-indexed
  const [data, setData]   = useState(null)
  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview') // overview | slips | template
  const [openSlip, setOpenSlip] = useState(null) // a history row, when viewing a slip in detail

  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get(`/attendance/my-report/${monthStr}`),
      api.get('/attendance/my-report')
    ]).then(([r, h]) => { setData(r.data); setHistory(h.data) })
      .catch(() => toast.error('Failed to load payroll data'))
      .finally(() => setLoading(false))
  }, [monthStr])

  useEffect(() => { load() }, [load])

  function prevM() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1)
  }
  function nextM() {
    if (isCurrentMonth) return
    if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1)
  }

  if (loading || !data) {
    return <div className="fade-in"><PayrollSkeleton /></div>
  }

  return (
    <div className="fade-in">
      <div className="payroll-tabs mb-2">
        <button className={`payroll-tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>Overview</button>
        <button className={`payroll-tab ${tab === 'slips' ? 'active' : ''}`} onClick={() => setTab('slips')}>My Salary Slips</button>
        <button className={`payroll-tab ${tab === 'template' ? 'active' : ''}`} onClick={() => setTab('template')}>My Salary Template</button>
      </div>

      {tab === 'overview' && (
        <>
          <div className="cal-nav mb-2">
            <button className="btn btn-secondary" style={{ padding: '.32rem .7rem', fontSize: '.85rem' }} onClick={prevM}>&#8249;</button>
            <span className="cal-nav-title">{MONTHS[month]} {year}</span>
            <button className="btn btn-secondary" style={{ padding: '.32rem .7rem', fontSize: '.85rem' }} onClick={nextM} disabled={isCurrentMonth}>&#8250;</button>
          </div>

          <div className="stats-grid mb-2">
            <div className="stat-card stat-P"><div className="stat-val">{data.P}</div><div className="stat-lbl">Present</div></div>
            <div className="stat-card stat-A"><div className="stat-val">{data.A}</div><div className="stat-lbl">Absent</div></div>
            <div className="stat-card stat-PP"><div className="stat-val">{data.PP}</div><div className="stat-lbl">Double</div></div>
          </div>

          <div className="card mb-2">
            <div className="font-600 mb-2 text-sm">Salary Breakdown</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
              <Row label={`${data.salaryType === 'daily' ? 'Daily' : 'Monthly'} Salary`} value={fmtMoney(data.salary)} />
              <Row label="Daily Rate" value={fmtMoney(data.dailySalary)} />
              <Row label="Gross Pay" value={fmtMoney(data.gross)} />
              {data.overtime > 0 && <Row label="Double-shift Pay" value={`+ ${fmtMoney(data.overtime)}`} accent="var(--success)" />}
              {data.leavePay > 0 && <Row label="Paid Leave" value={`+ ${fmtMoney(data.leavePay)}`} accent="var(--success)" />}
              {data.deductions > 0 && <Row label="Deductions" value={`− ${fmtMoney(data.deductions)}`} accent="var(--danger)" />}
              <div style={{ borderTop: '1px dashed var(--border)', margin: '.3rem 0' }} />
              <Row label="Net Pay" value={fmtMoney(data.net)} bold />
            </div>
          </div>

          {data.remarks?.length > 0 && (
            <div className="card mb-2">
              <div className="font-600 mb-1 text-sm">Remarks — {MONTHS[month]}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
                {data.remarks.map((r, i) => (
                  <div key={i} className="text-sm" style={{ padding: '.5rem .65rem', background: 'var(--bg3)', borderRadius: 8, color: 'var(--text2)' }}>{r}</div>
                ))}
              </div>
            </div>
          )}

          {history?.length > 0 && (
            <div className="card">
              <div className="font-600 mb-1 text-sm">Last 6 Months</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.35rem' }}>
                {history.map(h => {
                  const [hy, hm] = h.month.split('-').map(Number)
                  return (
                    <div key={h.month} className="flex justify-between items-center" style={{ padding: '.5rem .65rem', background: 'var(--bg3)', borderRadius: 8 }}>
                      <span className="text-sm text-2">{MONTHS[hm - 1].slice(0, 3)} {hy}</span>
                      <span className="font-600 text-sm">{fmtMoney(h.net)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'slips' && (
        <SalarySlipsTab history={history} onOpen={setOpenSlip} />
      )}

      {tab === 'template' && (
        <SalaryTemplateTab data={data} />
      )}

      {openSlip && <SlipModal row={openSlip} onClose={() => setOpenSlip(null)} />}
    </div>
  )
}

function SalarySlipsTab({ history, onOpen }) {
  if (!history || history.length === 0) {
    return <div className="card text-sm text-2" style={{ textAlign: 'center' }}>No salary slips yet.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
      {[...history].reverse().map(h => {
        const [hy, hm] = h.month.split('-').map(Number)
        return (
          <button key={h.month} className="card slip-row" onClick={() => onOpen(h)}>
            <div>
              <div className="font-600 text-sm">{MONTHS[hm - 1]} {hy}</div>
              <div className="text-xs text-2">{h.totalPresent} day{h.totalPresent === 1 ? '' : 's'} present</div>
            </div>
            <div className="flex items-center gap-1 text-sm">
              <span className="font-700">{fmtMoney(h.net)}</span>
              <ChevronIcon />
            </div>
          </button>
        )
      })}
    </div>
  )
}

function SalaryTemplateTab({ data }) {
  const user = (() => { try { return JSON.parse(localStorage.getItem('employeeUser') || '{}') } catch { return {} } })()
  return (
    <div className="card">
      <div className="font-700 mb-1">Salary Structure</div>
      <div className="text-xs text-2 mb-2">This reflects your current salary structure as configured by your admin.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
        <Row label="Employee" value={data.username || user.username} />
        <Row label="Designation" value={data.designation || user.designation || '—'} />
        <div style={{ borderTop: '1px dashed var(--border)', margin: '.3rem 0' }} />
        <Row label="Salary Type" value={data.salaryType === 'daily' ? 'Daily Wage' : 'Fixed Monthly'} />
        <Row label={data.salaryType === 'daily' ? 'Daily Wage' : 'Monthly Salary'} value={fmtMoney(data.salary)} />
        <Row label="Computed Daily Rate" value={fmtMoney(data.dailySalary)} />
        <Row label="Payment Cycle" value="Monthly" />
      </div>
      <div className="text-xs text-2 mt-2">
        Double-shift days pay 2× the daily rate.  |  Approved Half-Day leave pays 0.5× and Paid Leave pays the full daily rate.  |  Unpaid absences are not paid.
      </div>
    </div>
  )
}

function SlipModal({ row, onClose }) {
  const user = (() => { try { return JSON.parse(localStorage.getItem('employeeUser') || '{}') } catch { return {} } })()
  const [hy, hm] = row.month.split('-').map(Number)

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal slip-modal" onClick={e => e.stopPropagation()}>
        <div className="slip-printable">
          <div className="text-center mb-2">
            <div className="font-700" style={{ fontSize: '1.05rem' }}>{user?.company?.name || 'Salary Slip'}</div>
            <div className="text-xs text-2">Salary Slip — {MONTHS[hm - 1]} {hy}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }} className="mb-2">
            <Row label="Employee" value={row.username || user.username} />
            <Row label="Employee ID" value={row.employeeId || user.employeeId} />
            <Row label="Designation" value={row.designation || '—'} />
          </div>
          <div style={{ borderTop: '1px solid var(--border)', margin: '.5rem 0' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }} className="mb-2">
            <Row label="Days Present" value={row.P} />
            <Row label="Days Absent" value={row.A} />
            {row.PP > 0 && <Row label="Double-Shift Days" value={row.PP} />}
            {row.PL > 0 && <Row label="Paid Leave Days" value={row.PL} />}
            {row.HD > 0 && <Row label="Half-Day Leave" value={row.HD} />}
            <Row label="Total Paid Days" value={row.totalPresent} />
          </div>
          <div style={{ borderTop: '1px solid var(--border)', margin: '.5rem 0' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
            <Row label="Gross Pay" value={fmtMoney(row.gross)} />
            {row.overtime > 0 && <Row label="Double-shift Pay" value={`+ ${fmtMoney(row.overtime)}`} accent="var(--success)" />}
            {row.leavePay > 0 && <Row label="Paid Leave" value={`+ ${fmtMoney(row.leavePay)}`} accent="var(--success)" />}
            {row.deductions > 0 && <Row label="Deductions" value={`− ${fmtMoney(row.deductions)}`} accent="var(--danger)" />}
            <div style={{ borderTop: '1px dashed var(--border)', margin: '.3rem 0' }} />
            <Row label="Net Pay" value={fmtMoney(row.net)} bold />
          </div>
          {row.remarks?.length > 0 && (
            <div className="text-xs text-2 mt-2">{row.remarks.join(' · ')}</div>
          )}
        </div>
        <div className="flex gap-1 mt-2 no-print">
          <button className="btn btn-secondary btn-block" onClick={onClose}>Close</button>
          <button className="btn btn-primary btn-block" onClick={() => window.print()}>Print / Save PDF</button>
        </div>
      </div>
    </div>
  )
}

function ChevronIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
}

function Row({ label, value, accent, bold }) {
  return (
    <div className="flex justify-between items-center">
      <span className={bold ? 'font-700 text-sm' : 'text-sm text-2'}>{label}</span>
      <span className={bold ? 'font-700' : 'font-600 text-sm'} style={{ color: accent, fontSize: bold ? '1.05rem' : undefined }}>{value}</span>
    </div>
  )
}

export default function PayrollPage() {
  // Locking is intentionally in-memory only: leaving this page (or reloading
  // the app) re-locks it, so the PIN is genuinely required "whenever you
  // want to view" payroll, not just once per app session.
  const [stage, setStage] = useState('loading') // loading | setup | verify | unlocked

  useEffect(() => {
    api.get('/employees/payroll-pin/status')
      .then(({ data }) => setStage(data.hasPin ? 'verify' : 'setup'))
      .catch(() => toast.error('Failed to load payroll'))
  }, [])

  return (
    <div className="fade-in">
      <div className="font-700 mb-2" style={{ fontSize: '1.1rem' }}>Payroll</div>
      {stage === 'loading' && <PayrollSkeleton />}
      {stage === 'setup'   && <SetupPin onDone={() => setStage('unlocked')} />}
      {stage === 'verify'  && <VerifyPin onDone={() => setStage('unlocked')} />}
      {stage === 'unlocked' && <PayrollView />}
    </div>
  )
}
