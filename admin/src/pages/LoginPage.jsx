import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import './LoginPage.css'

export default function LoginPage() {
  const nav = useNavigate()
  const [form, setForm] = useState({ companyCode: '', username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
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
    <div className="login-container">
      <div className="login-wrapper">
        <div className="login-card fade-in">
          <div className="login-header">
            <div className="login-logo">
              <div className="logo-circle">A</div>
            </div>
            <h1>Welcome Back</h1>
            <p>Sign in to your company workspace</p>
          </div>

          <form onSubmit={submit} className="login-form">
            <div className="form-group">
              <label className="form-label">Company Code</label>
              <input 
                className="form-input"
                placeholder="e.g., ACME2024"
                value={form.companyCode}
                onChange={set('companyCode')}
                required 
                style={{ textTransform: 'uppercase' }} 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Username or Email</label>
              <input 
                className="form-input"
                placeholder="admin@example.com"
                value={form.username}
                onChange={set('username')}
                required 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="password-input-wrapper">
                <input 
                  className="form-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={set('password')}
                  required 
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            <button className="btn-submit" type="submit" disabled={loading}>
              {loading ? (
                <span className="spinner"></span>
              ) : (
                <>Sign In</>
              )}
            </button>
          </form>

          <div className="login-divider">
            <span>New here?</span>
          </div>

          <div className="login-links">
            <Link to="/register" className="link">
              <span>Register your company</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <Link to="/setup" className="link">
              <span>Set up admin account</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

        <div className="login-decoration">
          <div className="decoration-item item-1"></div>
          <div className="decoration-item item-2"></div>
          <div className="decoration-item item-3"></div>
        </div>
      </div>
    </div>
  )
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}