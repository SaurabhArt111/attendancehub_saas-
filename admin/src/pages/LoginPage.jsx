import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import './LoginPage.css'

const POLL_MS = 2500

export default function LoginPage() {
  const nav = useNavigate()
  const [form, setForm] = useState({ companyCode: '', username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [fieldError, setFieldError] = useState({})
  const [formError, setFormError] = useState('')

  // Set once a login attempt comes back requiring approval from an
  // already-trusted device (the account is signed in elsewhere).
  const [pending, setPending] = useState(null) // { pendingId, code, deviceLabel, expiresAt }
  const [pendingStatus, setPendingStatus] = useState('pending') // pending | denied | expired
  const pollRef = useRef(null)

  const set = k => e => {
    setForm(p => ({ ...p, [k]: e.target.value }))
    setFieldError(p => ({ ...p, [k]: '' }))
  }

  async function submit(e) {
    e.preventDefault()
    const errs = {}
    if (!form.companyCode.trim()) errs.companyCode = 'Company code is required'
    if (!form.username.trim()) errs.username = 'Username is required'
    if (!form.password) errs.password = 'Password is required'
    if (Object.keys(errs).length) { setFieldError(errs); return }

    setFieldError({})
    setFormError('')
    setLoading(true)
    try {
      const { data } = await api.post('/admin/login', form)

      if (data.requiresApproval) {
        setPending({ pendingId: data.pendingId, code: data.code, deviceLabel: data.deviceLabel, expiresAt: data.expiresAt })
        setPendingStatus('pending')
        return
      }

      localStorage.setItem('adminToken', data.token)
      localStorage.setItem('adminUser', JSON.stringify({ ...data.admin, company: data.company }))
      nav('/employees')
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed'
      if (err.response?.data?.deviceLimitReached) {
        setFormError(msg)
      } else if (/company|code/i.test(msg)) setFieldError({ companyCode: msg })
      else if (/username|user|admin/i.test(msg)) setFieldError({ username: msg })
      else if (/password/i.test(msg)) setFieldError({ password: msg })
      else setFieldError({ password: msg })
      toast.error(msg)
    } finally { setLoading(false) }
  }

  // Poll for the trusted device approving/denying this sign-in.
  useEffect(() => {
    if (!pending) return

    async function check() {
      try {
        const { data } = await api.get(`/admin/pending-login/${pending.pendingId}/status`)
        if (data.status === 'approved') {
          window.clearInterval(pollRef.current)
          localStorage.setItem('adminToken', data.token)
          localStorage.setItem('adminUser', JSON.stringify({ ...data.admin, company: data.company }))
          toast.success('Sign-in approved')
          nav('/employees')
        } else if (data.status === 'denied' || data.status === 'expired') {
          window.clearInterval(pollRef.current)
          setPendingStatus(data.status)
        }
      } catch {
        // transient network hiccup — keep polling
      }
    }

    check()
    pollRef.current = window.setInterval(check, POLL_MS)
    return () => window.clearInterval(pollRef.current)
  }, [pending, nav])

  function cancelPending() {
    window.clearInterval(pollRef.current)
    setPending(null)
    setPendingStatus('pending')
  }

  if (pending) {
    return (
      <div className="auth-bg">
        <div className="auth-card fade-in">
          <div className="auth-logo">AttendanceHub</div>
          <h1 className="auth-title">Approve this sign-in</h1>
          <p className="auth-sub">You're already signed in on another device</p>

          <div className="card login-form" style={{ textAlign: 'center' }}>
            {pendingStatus === 'pending' && (
              <>
                <div className="text-sm text-2 mb-2">
                  Open <strong>Settings → Login Code for Another Session</strong> on your other device
                  and enter this security key to approve signing in on <strong>{pending.deviceLabel}</strong>.
                </div>
                <div className="security-key-display">
                  {pending.code.split('').map((d, i) => <span key={i}>{d}</span>)}
                </div>
                <div className="flex items-center justify-center gap-1 text-xs text-2 mt-3">
                  <span className="spinner" /> Waiting for approval…
                </div>
              </>
            )}

            {pendingStatus === 'denied' && (
              <div className="text-sm" style={{ color: 'var(--danger)' }}>
                This sign-in was denied from your other device.
              </div>
            )}

            {pendingStatus === 'expired' && (
              <div className="text-sm" style={{ color: 'var(--danger)' }}>
                This security key expired before it was approved. Please sign in again.
              </div>
            )}

            <button className="btn btn-secondary btn-block mt-3" onClick={cancelPending}>
              {pendingStatus === 'pending' ? 'Cancel' : 'Back to sign in'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-bg">
      <div className="auth-card fade-in">
        <div className="auth-logo">AttendanceHub</div>
        <h1 className="auth-title">Admin Sign In</h1>
        <p className="auth-sub">Sign in to your company workspace</p>
        <form onSubmit={submit} className="card login-form" noValidate>
          <FieldWrap error={fieldError.companyCode}>
            <label className="label">Company Code</label>
            <input
              className={`input ${fieldError.companyCode ? 'input-error' : ''}`}
              placeholder="ABCD1234"
              value={form.companyCode}
              onChange={set('companyCode')}
            />
          </FieldWrap>
          <FieldWrap error={fieldError.username}>
            <label className="label">Username or Admin ID</label>
            <input
              className={`input ${fieldError.username ? 'input-error' : ''}`}
              placeholder="admin"
              value={form.username}
              onChange={set('username')}
            />
          </FieldWrap>
          <FieldWrap error={fieldError.password}>
            <label className="label">Password</label>
            <input
              className={`input ${fieldError.password ? 'input-error' : ''}`}
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={set('password')}
            />
          </FieldWrap>
          {formError && <div className="form-error-banner">{formError}</div>}
          <button className="btn btn-primary btn-block mt-2" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Sign In'}
          </button>
        </form>
        <div className="login-footer">
          <div className="footer-buttons">
            <p className="text-sm text-2">
              New organization? <Link to="/register" className="footer-link">Register company</Link>
            </p>
            <p className="text-sm text-2 mt-1">
              Already registered but no admin yet? <Link to="/setup" className="footer-link">Set up admin</Link>
            </p>
            <p className="text-sm text-2 mt-2">
              Want to learn more? <Link to="/about" className="footer-link">About AttendanceHub</Link>
            </p>
            <p className="text-sm text-2 mt-1">
              <Link to="/privacy-policy" className="footer-link">Privacy Policy</Link>
            </p>
          </div>
        </div>
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
