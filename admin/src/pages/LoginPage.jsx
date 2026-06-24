import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import './LoginPage.css'

export default function LoginPage() {
  const nav = useNavigate()
  const [form, setForm] = useState({ companyCode: '', username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/admin/login', form)
      localStorage.setItem('adminToken', data.token)
      localStorage.setItem('adminUser', JSON.stringify({ ...data.admin, company: data.company }))
      nav('/employees')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="auth-bg">
      <div className="auth-card fade-in">
        <div className="auth-logo">AttendanceHub</div>
        <h1 className="auth-title">Admin Sign In</h1>
        <p className="auth-sub">Sign in to your company workspace</p>
        <form onSubmit={submit} className="card">
          <div className="form-group">
            <label className="label">Company Code</label>
            <input className="input" placeholder="ABCD1234" value={form.companyCode}
              onChange={set('companyCode')} required style={{ textTransform: 'uppercase' }} />
          </div>
          <div className="form-group">
            <label className="label">Username or Admin ID</label>
            <input className="input" placeholder="admin" value={form.username} onChange={set('username')} required />
          </div>
          <div className="form-group">
            <label className="label">Password</label>
            <input className="input" type="password" placeholder="Password" value={form.password} onChange={set('password')} required />
          </div>
          <button className="btn btn-primary btn-block mt-2" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Sign In'}
          </button>
        </form>
        <div className="mt-2" style={{ textAlign: 'center' }}>
          <p className="text-sm text-2">
            New organization? <Link to="/register" style={{ color: 'var(--accent)' }}>Register company</Link>
          </p>
          <p className="text-sm text-2 mt-1">
            Already registered but no admin yet? <Link to="/setup" style={{ color: 'var(--accent)' }}>Set up admin</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
