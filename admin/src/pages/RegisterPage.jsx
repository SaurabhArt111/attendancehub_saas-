import { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import './RegisterPage.css'

// ─── OTP Input Component ──────────────────────────────────────────────────────
function OtpInput({ value, onChange, disabled }) {
  const inputs = useRef([])
  const digits  = value.split('')

  function handleKey(i, e) {
    if (e.key === 'Backspace') {
      if (!digits[i] && i > 0) inputs.current[i - 1]?.focus()
      const next = [...digits]; next[i] = ''; onChange(next.join(''))
    } else if (e.key === 'ArrowLeft' && i > 0) {
      inputs.current[i - 1]?.focus()
    } else if (e.key === 'ArrowRight' && i < 5) {
      inputs.current[i + 1]?.focus()
    }
  }
  function handleChange(i, e) {
    const val = e.target.value.replace(/\D/g, '').slice(-1)
    const next = [...digits]; next[i] = val; onChange(next.join(''))
    if (val && i < 5) inputs.current[i + 1]?.focus()
  }
  function handlePaste(e) {
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (paste.length) { onChange(paste.padEnd(6, '').slice(0, 6)); inputs.current[Math.min(paste.length, 5)]?.focus() }
    e.preventDefault()
  }

  return (
    <div className="otp-inputs">
      {[0,1,2,3,4,5].map(i => (
        <input key={i} ref={el => inputs.current[i] = el}
          className={`otp-digit ${digits[i] ? 'filled' : ''}`}
          type="text" inputMode="numeric" maxLength={1}
          value={digits[i] || ''} disabled={disabled}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKey(i, e)}
          onPaste={handlePaste}
        />
      ))}
    </div>
  )
}

// ─── Countdown Timer ──────────────────────────────────────────────────────────
function Countdown({ seconds, onExpire }) {
  const [left, setLeft] = useState(seconds)
  useEffect(() => {
    setLeft(seconds)
    const t = setInterval(() => setLeft(p => { if (p <= 1) { clearInterval(t); onExpire?.(); return 0 } return p - 1 }), 1000)
    return () => clearInterval(t)
  }, [seconds])
  const m = Math.floor(left / 60), s = left % 60
  return <span className={`countdown ${left <= 30 ? 'warn' : ''}`}>{m}:{String(s).padStart(2, '0')}</span>
}

export default function RegisterPage() {
  const nav = useNavigate()
  const [step, setStep]     = useState(1) // 1=form, 2=otp, 3=done
  const [form, setForm]     = useState({ name: '', email: '', contact: '', password: '', confirm: '' })
  const [otp, setOtp]       = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone]     = useState(null)
  const [otpExpired, setOtpExpired] = useState(false)
  const [countdown, setCountdown]   = useState(0)
  const [fieldError, setFieldError] = useState({})

  const set = k => e => { setForm(p => ({ ...p, [k]: e.target.value })); setFieldError(p => ({ ...p, [k]: '' })) }

  function validate() {
    const errs = {}
    if (!form.name.trim())    errs.name    = 'Company name is required'
    if (!form.email.trim())   errs.email   = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email address'
    if (!form.contact.trim()) errs.contact  = 'Contact number is required'
    if (!form.password)       errs.password = 'Password is required'
    else if (form.password.length < 6) errs.password = 'Minimum 6 characters'
    if (form.password !== form.confirm) errs.confirm = 'Passwords do not match'
    setFieldError(errs)
    return !Object.keys(errs).length
  }

  async function sendOtp() {
    if (!validate()) return
    setLoading(true)
    try {
      await api.post('/company/send-otp', { email: form.email, companyName: form.name })
      setStep(2); setOtp(''); setOtpExpired(false); setCountdown(c => c + 1)
      toast.success('Verification code sent to your email')
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to send OTP'
      if (/email/i.test(msg)) setFieldError(p => ({ ...p, email: msg }))
      toast.error(msg)
    } finally { setLoading(false) }
  }

  async function submitOtp(e) {
    e?.preventDefault()
    if (otp.length < 6) { toast.error('Enter the 6-digit code'); return }
    setLoading(true)
    try {
      const { data } = await api.post('/company/register', {
        name: form.name, email: form.email, contact: form.contact,
        password: form.password, otp
      })
      setDone(data); setStep(3)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed')
    } finally { setLoading(false) }
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (step === 3 && done) return (
    <div className="auth-bg">
      <div className="auth-card card fade-in" style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: '1rem' }}>
          <div className="success-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M6 16l7 7 13-13" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
        <h2 className="auth-title">Company Registered!</h2>
        <p className="auth-sub" style={{ marginBottom: '1.5rem' }}>
          <strong>{done.name}</strong> is live. A welcome email with your Company Code has been sent.
        </p>
        <div className="code-reveal-card">
          <div className="label" style={{ marginBottom: '0.5rem' }}>Your Company Code</div>
          <div className="company-code-display">{done.companyCode}</div>
          <div className="text-sm text-2 mt-1">Save this — you'll need it every time you log in</div>
        </div>
        <button className="btn btn-primary btn-block mt-3" onClick={() => nav('/setup', { state: { fromRegister: true } })}>
          Set Up Admin Account →
        </button>
        <p className="text-sm text-2 mt-2">Check your email for a welcome message with full details.</p>
      </div>
    </div>
  )

  return (
    <div className="auth-bg">
      <div className="auth-card fade-in">
        <div className="auth-logo">AttendanceHub</div>

        {/* Step indicator */}
        <div className="step-track">
          {['Company Info', 'Verify Email', 'Done'].map((label, i) => (
            <div key={i} className={`step-item ${step > i + 1 ? 'done' : step === i + 1 ? 'active' : ''}`}>
              <div className="step-circle">{step > i + 1 ? '✓' : i + 1}</div>
              <div className="step-label">{label}</div>
            </div>
          ))}
          <div className="step-line" style={{ '--progress': `${((step - 1) / 2) * 100}%` }} />
        </div>

        {/* ── Step 1: Registration form ── */}
        {step === 1 && (
          <>
            <h1 className="auth-title">Register Your Company</h1>
            <p className="auth-sub">Create a workspace for your organization</p>
            <div className="card">
              <FieldWrap error={fieldError.name}>
                <label className="label">Company Name</label>
                <input className={`input ${fieldError.name ? 'input-error' : ''}`}
                  placeholder="Acme Pvt Ltd" value={form.name} onChange={set('name')} />
              </FieldWrap>
              <FieldWrap error={fieldError.email}>
                <label className="label">Email Address</label>
                <input className={`input ${fieldError.email ? 'input-error' : ''}`}
                  type="email" placeholder="admin@company.com" value={form.email} onChange={set('email')} />
                <div className="field-hint">OTP will be sent to verify this email</div>
              </FieldWrap>
              <FieldWrap error={fieldError.contact}>
                <label className="label">Contact Number</label>
                <input className={`input ${fieldError.contact ? 'input-error' : ''}`}
                  placeholder="9876543210" value={form.contact} onChange={set('contact')} />
              </FieldWrap>
              <FieldWrap error={fieldError.password}>
                <label className="label">Password</label>
                <input className={`input ${fieldError.password ? 'input-error' : ''}`}
                  type="password" placeholder="Min 6 characters" value={form.password} onChange={set('password')} />
              </FieldWrap>
              <FieldWrap error={fieldError.confirm}>
                <label className="label">Confirm Password</label>
                <input className={`input ${fieldError.confirm ? 'input-error' : ''}`}
                  type="password" placeholder="Repeat password" value={form.confirm} onChange={set('confirm')} />
              </FieldWrap>
              <button className="btn btn-primary btn-block mt-2" onClick={sendOtp} disabled={loading}>
                {loading ? <span className="spinner" /> : 'Send Verification Code →'}
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: OTP verification ── */}
        {step === 2 && (
          <>
            <h1 className="auth-title">Verify Your Email</h1>
            <p className="auth-sub">
              We sent a 6-digit code to<br /><strong style={{ color: 'var(--text)' }}>{form.email}</strong>
            </p>
            <div className="card">
              <div className="otp-label">Enter verification code</div>
              <OtpInput value={otp} onChange={setOtp} disabled={loading || otpExpired} />

              {!otpExpired && (
                <div className="otp-timer">
                  Code expires in <Countdown key={countdown} seconds={600} onExpire={() => setOtpExpired(true)} />
                </div>
              )}
              {otpExpired && (
                <div className="otp-expired">Code expired.</div>
              )}

              <button className="btn btn-primary btn-block mt-3"
                onClick={submitOtp} disabled={loading || otp.length < 6 || otpExpired}>
                {loading ? <span className="spinner" /> : 'Verify & Create Company'}
              </button>

              <div className="otp-resend-row">
                Didn't receive it?{' '}
                <button className="link-btn" onClick={sendOtp} disabled={loading}>
                  {loading ? 'Sending…' : 'Resend Code'}
                </button>
              </div>
              <button className="link-btn mt-1" onClick={() => setStep(1)}>← Edit details</button>
            </div>
          </>
        )}

        <p className="text-sm text-2 mt-2" style={{ textAlign: 'center' }}>
          Already registered? <Link to="/login" style={{ color: 'var(--primary)' }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}

function FieldWrap({ error, children }) {
  return (
    <div className={`form-group ${error ? 'form-group-error' : ''}`}>
      {children}
      {error && <div className="field-error-msg">{error}</div>}
    </div>
  )
}
