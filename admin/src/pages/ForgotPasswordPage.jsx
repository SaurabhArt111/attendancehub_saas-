import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import './RegisterPage.css'
import './ForgotPage.css'

function OtpInput({ value, onChange, disabled }) {
  const inputs = useRef([])
  const digits  = value.split('')
  function handleKey(i, e) {
    if (e.key === 'Backspace') { if(!digits[i]&&i>0)inputs.current[i-1]?.focus(); const n=[...digits];n[i]='';onChange(n.join('')) }
    else if (e.key==='ArrowLeft'&&i>0) inputs.current[i-1]?.focus()
    else if (e.key==='ArrowRight'&&i<5) inputs.current[i+1]?.focus()
  }
  function handleChange(i, e) {
    const v=e.target.value.replace(/\D/g,'').slice(-1); const n=[...digits];n[i]=v;onChange(n.join(''))
    if(v&&i<5)inputs.current[i+1]?.focus()
  }
  function handlePaste(e) {
    const p=e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6)
    if(p.length){onChange(p.padEnd(6,'').slice(0,6));inputs.current[Math.min(p.length,5)]?.focus()}
    e.preventDefault()
  }
  return (
    <div className="otp-inputs">
      {[0,1,2,3,4,5].map(i=>(
        <input key={i} ref={el=>inputs.current[i]=el}
          className={`otp-digit ${digits[i]?'filled':''}`}
          type="text" inputMode="numeric" maxLength={1}
          value={digits[i]||''} disabled={disabled}
          onChange={e=>handleChange(i,e)} onKeyDown={e=>handleKey(i,e)} onPaste={handlePaste}/>
      ))}
    </div>
  )
}

function Countdown({seconds, onExpire}) {
  const [left,setLeft]=useState(seconds)
  useEffect(()=>{
    setLeft(seconds)
    const t=setInterval(()=>setLeft(p=>{if(p<=1){clearInterval(t);onExpire?.();return 0}return p-1}),1000)
    return()=>clearInterval(t)
  },[seconds])
  const m=Math.floor(left/60),s=left%60
  return <span className={`countdown ${left<=30?'warn':''}`}>{m}:{String(s).padStart(2,'0')}</span>
}

function PasswordStrength({ password }) {
  if (!password) return null
  const checks = [
    password.length >= 6,
    password.length >= 10,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^a-zA-Z0-9]/.test(password),
  ]
  const score = checks.filter(Boolean).length
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong']
  const colors = ['', '#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#10b981']
  return (
    <div className="pwd-strength">
      <div className="pwd-bars">
        {[1,2,3,4,5].map(i=>(
          <div key={i} className="pwd-bar" style={{background: i<=score ? colors[score] : 'var(--border)'}} />
        ))}
      </div>
      <span style={{color: colors[score], fontSize:'11px', fontWeight:600}}>{labels[score]}</span>
    </div>
  )
}

export default function ForgotPasswordPage() {
  const [step, setStep]       = useState(1)
  const [emailAddr, setEmailAddr] = useState('')
  const [otp, setOtp]         = useState('')
  const [newPwd, setNewPwd]   = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [loading, setLoading] = useState(false)
  const [expired, setExpired] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [emailErr, setEmailErr] = useState('')
  const [pwdErr, setPwdErr]   = useState('')
  const [done, setDone]       = useState(false)
  const [showPwd, setShowPwd] = useState(false)

  async function sendOtp() {
    if (!emailAddr.trim()) { setEmailErr('Email is required'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddr)) { setEmailErr('Enter a valid email'); return }
    setEmailErr(''); setLoading(true)
    try {
      const { data } = await api.post('/company/forgot-password/send-otp', { email: emailAddr })
      toast.success(data.message)
      setStep(2); setOtp(''); setExpired(false); setCountdown(c=>c+1)
    } catch(e) { toast.error(e.response?.data?.error || 'Failed to send OTP') }
    finally { setLoading(false) }
  }

  async function verifyOtp() {
    if (otp.length < 6) { toast.error('Enter the 6-digit code'); return }
    setLoading(true)
    try {
      await api.post('/company/forgot-password/verify-otp', { email: emailAddr, otp })
      setStep(3)
    } catch(e) { toast.error(e.response?.data?.error || 'Verification failed') }
    finally { setLoading(false) }
  }

  async function resetPassword() {
    if (newPwd.length < 6) { setPwdErr('Minimum 6 characters'); return }
    if (newPwd !== confirmPwd) { setPwdErr('Passwords do not match'); return }
    setPwdErr(''); setLoading(true)
    try {
      await api.post('/company/forgot-password/reset', { email: emailAddr, otp, newPassword: newPwd })
      setDone(true); setStep(4)
    } catch(e) { toast.error(e.response?.data?.error || 'Reset failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="auth-bg">
      <div className="auth-card fade-in">
        <div className="auth-logo">AttendanceHub</div>
        <div className="forgot-back"><Link to="/login">← Back to login</Link></div>

        {step === 1 && (
          <>
            <div className="forgot-icon amber">&#x1F510;</div>
            <h1 className="auth-title">Reset Password</h1>
            <p className="auth-sub">Enter your registered email address. We'll send a verification code.</p>
            <div className="card">
              <div className={`form-group ${emailErr?'form-group-error':''}`}>
                <label className="label">Registered Email</label>
                <input className={`input ${emailErr?'input-error':''}`} type="email" placeholder="admin@company.com"
                  value={emailAddr} onChange={e=>{setEmailAddr(e.target.value);setEmailErr('')}} />
                {emailErr && <div className="field-error-msg">{emailErr}</div>}
              </div>
              <button className="btn btn-primary btn-block mt-2" onClick={sendOtp} disabled={loading}>
                {loading?<span className="spinner"/>:'Send Verification Code'}
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="forgot-icon amber">&#x1F4E7;</div>
            <h1 className="auth-title">Enter OTP</h1>
            <p className="auth-sub">Code sent to<br/><strong style={{color:'var(--text)'}}>{emailAddr}</strong></p>
            <div className="card">
              <div className="otp-label">Enter 6-digit code</div>
              <OtpInput value={otp} onChange={setOtp} disabled={loading||expired}/>
              {!expired && <div className="otp-timer">Expires in <Countdown key={countdown} seconds={600} onExpire={()=>setExpired(true)}/></div>}
              {expired  && <div className="otp-expired">Code expired. Request a new one.</div>}
              <button className="btn btn-primary btn-block mt-3" onClick={verifyOtp} disabled={loading||otp.length<6||expired}>
                {loading?<span className="spinner"/>:'Verify Code'}
              </button>
              <div className="otp-resend-row">
                Didn't receive it? <button className="link-btn" onClick={sendOtp} disabled={loading}>Resend Code</button>
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="forgot-icon amber">&#x1F511;</div>
            <h1 className="auth-title">Set New Password</h1>
            <p className="auth-sub">Choose a strong new password for your company account.</p>
            <div className="card">
              <div className={`form-group ${pwdErr?'form-group-error':''}`}>
                <label className="label">New Password</label>
                <div style={{position:'relative'}}>
                  <input className={`input ${pwdErr?'input-error':''}`}
                    type={showPwd?'text':'password'} placeholder="Min 6 characters"
                    value={newPwd} onChange={e=>{setNewPwd(e.target.value);setPwdErr('')}}
                    style={{paddingRight:'3rem'}} />
                  <button type="button" className="pwd-toggle" onClick={()=>setShowPwd(p=>!p)}>
                    {showPwd ? '🙈' : '👁'}
                  </button>
                </div>
                <PasswordStrength password={newPwd}/>
              </div>
              <div className={`form-group ${pwdErr?'form-group-error':''}`}>
                <label className="label">Confirm Password</label>
                <input className={`input ${pwdErr?'input-error':''}`}
                  type={showPwd?'text':'password'} placeholder="Repeat password"
                  value={confirmPwd} onChange={e=>{setConfirmPwd(e.target.value);setPwdErr('')}}/>
                {pwdErr && <div className="field-error-msg">{pwdErr}</div>}
              </div>
              <button className="btn btn-primary btn-block mt-2" onClick={resetPassword} disabled={loading}>
                {loading?<span className="spinner"/>:'Reset Password'}
              </button>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div className="forgot-icon green">&#x2714;</div>
            <h1 className="auth-title">Password Reset!</h1>
            <p className="auth-sub">Your company account password has been changed successfully. A confirmation email has been sent.</p>
            <div className="card" style={{textAlign:'center'}}>
              <Link to="/login">
                <button className="btn btn-primary btn-block">Sign In Now →</button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
