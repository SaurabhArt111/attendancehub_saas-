import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import './RegisterPage.css'

export default function RegisterPage() {
  const nav = useNavigate()
  const [form, setForm] = useState({ name: '', contact: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(null)

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    if (form.password !== form.confirm) { toast.error('Passwords do not match'); return }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      const { data } = await api.post('/company/register', {
        name: form.name, contact: form.contact, email: form.email, password: form.password
      })
      setDone(data)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed')
    } finally { setLoading(false) }
  }

  const copyCompanyCode = async () => {
    if (!done?.companyCode) return
    if (!navigator.clipboard) {
      toast.error('Copy not supported')
      return
    }

    try {
      await navigator.clipboard.writeText(done.companyCode)
      toast.success('Company Code copied')
    } catch {
      toast.error('Copy failed')
    }
  }

  if (done) return (
    <div className="auth-bg">
      <div className="auth-card card fade-in success-card">
        <div className="success-icon-wrapper">
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none" className="success-icon">
            <circle cx="28" cy="28" r="28" fill="rgba(34,197,94,0.15)" />
            <path d="M18 28l7 7 13-13" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="auth-title">Company Registered</h2>
        <p className="auth-sub success-sub">
          Your company <strong>{done.name}</strong> has been registered.
        </p>
        <div className="card company-code-card">
          <div className="label">Your Company Code</div>
          <div className="company-code-display">
            {done.companyCode}
          </div>
          <button type="button" className="btn btn-secondary btn-sm company-code-copy-btn" onClick={copyCompanyCode}>
            Copy Code
          </button>
          <div className="company-code-hint">Save this code — you will need it to log in</div>
        </div>
        <button className="btn btn-primary btn-block" onClick={() => nav('/setup', { state: { fromRegister: true } })}>
          Set Up Admin Account
        </button>
      </div>
    </div>
  )

  return (
    <div className="auth-bg">
      <div className="auth-card fade-in">
        <div className="auth-logo">AttendanceHub</div>
        <div className="step-dots">
          <div className="step-dot active" />
          <div className="step-dot" />
          <div className="step-dot" />
        </div>
        <h1 className="auth-title">Register Your Company</h1>
        <p className="auth-sub">Create a workspace for your organization</p>
        <form onSubmit={submit} className="card register-form">
          <div className="form-group">
            <label className="label">Company Name</label>
            <input className="input" placeholder="Acme Pvt Ltd" value={form.name} onChange={set('name')} required />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Contact Number</label>
              <input className="input" placeholder="9876543210" value={form.contact} onChange={set('contact')} required />
            </div>
            <div className="form-group">
              <label className="label">Company Email</label>
              <input className="input" type="email" placeholder="company@email.com" value={form.email} onChange={set('email')} required />
            </div>
          </div>
          <div className="form-group">
            <label className="label">Password</label>
            <input className="input" type="password" placeholder="Min 6 characters" value={form.password} onChange={set('password')} required />
          </div>
          <div className="form-group">
            <label className="label">Confirm Password</label>
            <input className="input" type="password" placeholder="Repeat password" value={form.confirm} onChange={set('confirm')} required />
          </div>
          <button className="btn btn-primary btn-block mt-2" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Register Company'}
          </button>
        </form>
        <p className="auth-footer">
          Already registered? <Link to="/login" className="footer-link">Sign in</Link>
        </p>
        <p className="text-sm text-2 mt-2">
          Want to learn more? <Link to="/about" className="footer-link">About AttendanceHub</Link>
        </p>
      </div>
    </div>
  )
}
