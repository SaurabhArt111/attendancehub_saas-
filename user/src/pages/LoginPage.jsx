import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { toast } from '../components/Toaster'

export default function LoginPage() {
  const nav = useNavigate()
  const [form, setForm] = useState({ employeeId: '', password: '' })
  const [loading, setLoading] = useState(false)
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/employees/login', form)
      localStorage.setItem('employeeToken', data.token)
      localStorage.setItem('employeeUser', JSON.stringify({ ...data.employee, company: data.company }))
      nav('/')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="auth-bg">
      <div className="auth-card fade-in">
        <div className="auth-logo">AttendanceHub</div>
        <h1 className="auth-title">Employee Sign In</h1>
        <p className="auth-sub">Use your Employee ID provided by your manager</p>
        <form onSubmit={submit} className="card">
          <div className="form-group">
            <label className="label">Employee ID</label>
            <input className="input" placeholder="e.g. ACM001" value={form.employeeId}
              onChange={set('employeeId')} required
              style={{ textTransform: 'uppercase', fontFamily: 'monospace', fontSize: '1rem', letterSpacing: '.05em' }} />
            <div className="text-xs text-2 mt-1">Your unique ID — no company code needed</div>
          </div>
          <div className="form-group">
            <label className="label">Password</label>
            <input className="input" type="password" placeholder="Password" value={form.password} onChange={set('password')} required />
          </div>
          <button className="btn btn-primary btn-block mt-1" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Sign In'}
          </button>
        </form>
        <p className="text-xs text-2 mt-2" style={{ textAlign: 'center' }}>
          Contact your manager for your Employee ID and password
        </p>
      </div>
    </div>
  )
}
