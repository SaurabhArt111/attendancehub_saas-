import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { toast } from '../components/Toaster'

export default function RegisterPage() {
  const nav = useNavigate()
  const [form, setForm] = useState({ name: '', contact: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(null)

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    if (form.password !== form.confirm) { toast.error('Passwords do not match'); return }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      const { data } = await axios.post('/api/company/register', {
        name: form.name, contact: form.contact, password: form.password
      })
      setDone(data)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed')
    } finally { setLoading(false) }
  }

  if (done) return (
    <div className="auth-bg">
      <div className="auth-card card fade-in" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none" style={{ margin: '0 auto' }}>
            <circle cx="28" cy="28" r="28" fill="rgba(34,197,94,0.15)" />
            <path d="M18 28l7 7 13-13" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 className="auth-title">Company Registered</h2>
        <p className="auth-sub" style={{ marginBottom: '1.5rem' }}>
          Your company <strong>{done.name}</strong> has been registered.
        </p>
        <div className="card card-sm" style={{ background: 'var(--bg3)', marginBottom: '1.5rem' }}>
          <div className="label">Your Company Code</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.1em' }}>
            {done.companyCode}
          </div>
          <div className="text-sm text-2 mt-1">Save this code — you will need it to log in</div>
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
          <div className="step-dot active" /><div className="step-dot" /><div className="step-dot" />
        </div>
        <h1 className="auth-title">Register Your Company</h1>
        <p className="auth-sub">Create a workspace for your organization</p>
        <form onSubmit={submit} className="card">
          <div className="form-group">
            <label className="label">Company Name</label>
            <input className="input" placeholder="Acme Pvt Ltd" value={form.name} onChange={set('name')} required />
          </div>
          <div className="form-group">
            <label className="label">Contact Number</label>
            <input className="input" placeholder="9876543210" value={form.contact} onChange={set('contact')} required />
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
        <p className="text-sm text-2 mt-2" style={{ textAlign: 'center' }}>
          Already registered? <Link to="/login" style={{ color: 'var(--accent)' }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
