import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import './SetupPage.css'

export default function SetupPage() {
  const nav = useNavigate()
  const [step, setStep] = useState(1)
  const [companyData, setCompanyData] = useState(null)
  const [setupToken, setSetupToken] = useState('')
  const [cForm, setCForm] = useState({ companyCode: '', password: '' })
  const [aForm, setAForm] = useState({ username: '', adminId: '', contact: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)

  const setC = k => e => setCForm(p => ({ ...p, [k]: e.target.value }))
  const setA = k => e => setAForm(p => ({ ...p, [k]: e.target.value }))

  async function companyLogin(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/company/login', cForm)
      if (data.adminSetupDone) {
        toast.error('Primary admin already set up. Please log in.')
        nav('/login')
        return
      }
      setSetupToken(data.token)
      setCompanyData(data)
      setStep(2)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid company credentials')
    } finally { setLoading(false) }
  }

  async function createAdmin(e) {
    e.preventDefault()
    if (aForm.password !== aForm.confirm) { toast.error('Passwords do not match'); return }
    if (aForm.password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      const { data } = await api.post('/admin/setup', {
        companySetupToken: setupToken,
        username: aForm.username,
        adminId:  aForm.adminId,
        contact:  aForm.contact,
        email:    aForm.email,
        password: aForm.password
      })
      localStorage.setItem('adminToken', data.token)
      localStorage.setItem('adminUser', JSON.stringify({ ...data.admin, company: data.company }))
      toast.success('Admin account created successfully')
      nav('/employees')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Setup failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="auth-bg">
      <div className="auth-card fade-in">
        <div className="auth-logo">AttendanceHub</div>
        <div className="step-dots">
          <div className="step-dot done" />
          <div className={`step-dot ${step === 2 ? 'active' : ''}`} />
          <div className="step-dot" />
        </div>

        {step === 1 && <>
          <h1 className="auth-title">Verify Company</h1>
          <p className="auth-sub">Enter your company credentials to set up the admin account</p>
          <form onSubmit={companyLogin} className="card">
            <div className="form-group">
              <label className="label">Company Code</label>
              <input className="input" placeholder="ABCD1234" value={cForm.companyCode}
                onChange={setC('companyCode')} required style={{ textTransform: 'uppercase' }} />
            </div>
            <div className="form-group">
              <label className="label">Company Password</label>
              <input className="input" type="password" placeholder="Company password" value={cForm.password} onChange={setC('password')} required />
            </div>
            <button className="btn btn-primary btn-block mt-2" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Verify & Continue'}
            </button>
          </form>
          <p className="text-sm text-2 mt-2" style={{ textAlign: 'center' }}>
            <Link to="/login" style={{ color: 'var(--accent)' }}>Back to Sign In</Link>
          </p>
        </>}

        {step === 2 && <>
          <h1 className="auth-title">Create Admin Account</h1>
          <p className="auth-sub">
            Setting up admin for <strong style={{ color: 'var(--text)' }}>{companyData?.name}</strong>
          </p>
          <form onSubmit={createAdmin} className="card">
            <div className="grid-2">
              <div className="form-group">
                <label className="label">Admin Name</label>
                <input className="input" placeholder="Your Name" value={aForm.username} onChange={setA('username')} required />
              </div>
              <div className="form-group">
                <label className="label">Admin ID</label>
                <input className="input" placeholder="ADM001" value={aForm.adminId} onChange={setA('adminId')} required />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="label">Contact Number</label>
                <input className="input" placeholder="9876543210" value={aForm.contact} onChange={setA('contact')} />
              </div>
              <div className="form-group">
                <label className="label">Email</label>
                <input className="input" type="email" placeholder="admin@email.com" value={aForm.email} onChange={setA('email')} />
              </div>
            </div>
            <div className="form-group">
              <label className="label">Password</label>
              <input className="input" type="password" placeholder="Min 6 characters" value={aForm.password} onChange={setA('password')} required />
            </div>
            <div className="form-group">
              <label className="label">Confirm Password</label>
              <input className="input" type="password" placeholder="Repeat password" value={aForm.confirm} onChange={setA('confirm')} required />
            </div>
            <button className="btn btn-primary btn-block mt-2" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Create Admin Account'}
            </button>
          </form>
        </>}
      </div>
    </div>
  )
}
