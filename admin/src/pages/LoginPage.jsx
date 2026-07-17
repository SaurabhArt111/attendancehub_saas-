import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import './LoginPage.css'

export default function LoginPage() {
  const nav = useNavigate()
  const [form, setForm] = useState({ companyCode: '', username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [fieldError, setFieldError] = useState({})

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

    setLoading(true)
    try {
      const { data } = await api.post('/admin/login', form)
      localStorage.setItem('adminToken', data.token)
      localStorage.setItem('adminUser', JSON.stringify({ ...data.admin, company: data.company }))
      nav('/employees')
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed'
      if (/company|code/i.test(msg)) setFieldError({ companyCode: msg })
      else if (/username|user|admin/i.test(msg)) setFieldError({ username: msg })
      else if (/password/i.test(msg)) setFieldError({ password: msg })
      else setFieldError({ password: msg })
      toast.error(msg)
    } finally { setLoading(false) }
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
          <button className="btn btn-primary btn-block mt-2" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Sign In'}
          </button>
        </form>
        <div className="login-footer">
          <p className="text-sm text-2">
            New organization? <Link to="/register" className="footer-link">Register company</Link>
          </p>
          <p className="text-sm text-2 mt-1">
            Already registered but no admin yet? <Link to="/setup" className="footer-link">Set up admin</Link>
          </p>
          <p className="text-sm text-2 mt-2">
            Want to learn more? <Link to="/about" className="footer-link">About AttendanceHub</Link>
          </p>
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
