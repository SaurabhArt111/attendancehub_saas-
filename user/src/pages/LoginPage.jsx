import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { toast } from '../components/Toaster'

export default function LoginPage() {
  const nav = useNavigate()
  const [form, setForm] = useState({ employeeId: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [fieldError, setFieldError] = useState({})
  const set = k => e => {
    setForm(p => ({ ...p, [k]: e.target.value }))
    setFieldError(p => ({ ...p, [k]: '' }))
  }

  async function submit(e) {
    e.preventDefault()
    const errs = {}
    if (!form.employeeId.trim()) errs.employeeId = 'Employee ID is required'
    if (!form.password)          errs.password   = 'Password is required'
    if (Object.keys(errs).length) { setFieldError(errs); return }

    setLoading(true)
    try {
      const { data } = await api.post('/employees/login', form)
      localStorage.setItem('employeeToken', data.token)
      localStorage.setItem('employeeUser', JSON.stringify({ ...data.employee, company: data.company }))
      nav('/')
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed'
      if (/id|employee/i.test(msg))  setFieldError({ employeeId: msg })
      else if (/password/i.test(msg)) setFieldError({ password: msg })
      else                             setFieldError({ password: msg })
      toast.error(msg)
    } finally { setLoading(false) }
  }

  return (
    <div className="auth-bg">
      <div className="auth-card fade-in">
        <div className="auth-logo">AttendanceHub</div>
        <h1 className="auth-title">Employee Sign In</h1>
        <p className="auth-sub">Use your Employee ID provided by your manager</p>
        <form onSubmit={submit} className="card" noValidate>
          <div className={`form-group ${fieldError.employeeId ? 'form-group-error' : ''}`}>
            <label className="label">Employee ID</label>
            <input className={`input ${fieldError.employeeId ? 'input-error' : ''}`}
              placeholder="e.g. ACM001" value={form.employeeId}
              onChange={set('employeeId')}
              style={{ textTransform: 'uppercase', fontFamily: 'monospace', fontSize: '1rem', letterSpacing: '.05em' }} />
            {fieldError.employeeId
              ? <div className="field-error-msg">{fieldError.employeeId}</div>
              : <div className="text-xs text-2 mt-1">Your unique ID — no company code needed</div>}
          </div>
          <div className={`form-group ${fieldError.password ? 'form-group-error' : ''}`}>
            <label className="label">Password</label>
            <input className={`input ${fieldError.password ? 'input-error' : ''}`}
              type="password" placeholder="Password" value={form.password} onChange={set('password')} />
            {fieldError.password && <div className="field-error-msg">{fieldError.password}</div>}
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
