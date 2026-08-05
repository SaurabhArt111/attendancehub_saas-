import { useState, useEffect, useCallback } from 'react'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import { PayrollSkeleton } from '../components/Skeleton'

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
    </div>
  )
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
