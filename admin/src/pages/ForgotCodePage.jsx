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
    if (e.key === 'Backspace') {
      if (!digits[i] && i > 0) inputs.current[i - 1]?.focus()
      const n = [...digits]; n[i] = ''; onChange(n.join(''))
    } else if (e.key === 'ArrowLeft' && i > 0) inputs.current[i-1]?.focus()
    else if (e.key === 'ArrowRight' && i < 5) inputs.current[i+1]?.focus()
  }
  function handleChange(i, e) {
    const v = e.target.value.replace(/\D/g,'').slice(-1)
    const n = [...digits]; n[i] = v; onChange(n.join(''))
    if (v && i < 5) inputs.current[i+1]?.focus()
  }
  function handlePaste(e) {
    const p = e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6)
    if (p.length) { onChange(p.padEnd(6,'').slice(0,6)); inputs.current[Math.min(p.length,5)]?.focus() }
    e.preventDefault()
  }
  return (
    <div className="otp-inputs">
      {[0,1,2,3,4,5].map(i=>(
        <input key={i} ref={el=>inputs.current[i]=el}
          className={`otp-digit ${digits[i]?'filled':''}`}
          type="text" inputMode="numeric" maxLength={1}
          value={digits[i]||''} disabled={disabled}
          onChange={e=>handleChange(i,e)}
          onKeyDown={e=>handleKey(i,e)}
          onPaste={handlePaste} />
      ))}
    </div>
  )
}

function Countdown({ seconds, onExpire }) {
  const [left, setLeft] = useState(seconds)
  useEffect(() => {
    setLeft(seconds)
    const t = setInterval(()=>setLeft(p=>{ if(p<=1){clearInterval(t);onExpire?.();return 0} return p-1 }),1000)
    return ()=>clearInterval(t)
  },[seconds])
  const m = Math.floor(left/60), s = left%60
  return <span className={`countdown ${left<=30?'warn':''}`}>{m}:{String(s).padStart(2,'0')}</span>
}

export default function ForgotCodePage() {
  const [step, setStep]     = useState(1)
  const [emailAddr, setEmailAddr] = useState('')
  const [otp, setOtp]       = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [expired, setExpired] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [emailErr, setEmailErr] = useState('')

  async function sendOtp() {
    if (!emailAddr.trim()) { setEmailErr('Email is required'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddr)) { setEmailErr('Enter a valid email'); return }
    setEmailErr(''); setLoading(true)
    try {
      const { data } = await api.post('/company/forgot-code/send-otp', { email: emailAddr })
      toast.success(data.message)
      setStep(2); setOtp(''); setExpired(false); setCountdown(c=>c+1)
    } catch(e) { toast.error(e.response?.data?.error || 'Failed to send OTP') }
    finally { setLoading(false) }
  }

  async function verify() {
    if (otp.length < 6) { toast.error('Enter the 6-digit code'); return }
    setLoading(true)
    try {
      const { data } = await api.post('/company/forgot-code/verify', { email: emailAddr, otp })
      setResult(data); setStep(3)
    } catch(e) { toast.error(e.response?.data?.error || 'Verification failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="auth-bg">
      <div className="auth-card fade-in">
        <div className="auth-logo">AttendanceHub</div>
        <div className="forgot-back"><Link to="/login">← Back to login</Link></div>

        {step === 1 && (
          <>
            <div className="forgot-icon purple">&#x1F3E2;</div>
            <h1 className="auth-title">Forgot Company Code?</h1>
            <p className="auth-sub">Enter the email address used during registration. We'll send a verification code.</p>
            <div className="card">
              <div className={`form-group ${emailErr ? 'form-group-error' : ''}`}>
                <label className="label">Registered Email</label>
                <input className={`input ${emailErr?'input-error':''}`}
                  type="email" placeholder="admin@company.com"
                  value={emailAddr} onChange={e=>{setEmailAddr(e.target.value);setEmailErr('')}} />
                {emailErr && <div className="field-error-msg">{emailErr}</div>}
              </div>
              <button className="btn btn-primary btn-block mt-2" onClick={sendOtp} disabled={loading}>
                {loading ? <span className="spinner"/> : 'Send Verification Code'}
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="forgot-icon purple">&#x1F511;</div>
            <h1 className="auth-title">Enter OTP</h1>
            <p className="auth-sub">Verification code sent to<br/><strong style={{color:'var(--text)'}}>{emailAddr}</strong></p>
            <div className="card">
              <div className="otp-label">Enter 6-digit code</div>
              <OtpInput value={otp} onChange={setOtp} disabled={loading||expired} />
              {!expired && <div className="otp-timer">Expires in <Countdown key={countdown} seconds={600} onExpire={()=>setExpired(true)}/></div>}
              {expired  && <div className="otp-expired">Code expired. Request a new one.</div>}
              <button className="btn btn-primary btn-block mt-3" onClick={verify} disabled={loading||otp.length<6||expired}>
                {loading ? <span className="spinner"/> : 'Verify & Reveal Code'}
              </button>
              <div className="otp-resend-row">
                Didn't receive it? <button className="link-btn" onClick={sendOtp} disabled={loading}>Resend Code</button>
              </div>
            </div>
          </>
        )}

        {step === 3 && result && (
          <>
            <div className="forgot-icon green">&#x2714;</div>
            <h1 className="auth-title">Code Retrieved</h1>
            <p className="auth-sub">Your Company Code has been sent to your email and is shown below.</p>
            <div className="card" style={{textAlign:'center'}}>
              <div className="label" style={{marginBottom:'0.5rem'}}>Company — {result.companyName}</div>
              <div className="company-code-display" style={{color:'var(--primary)'}}>{result.companyCode}</div>
              <p className="text-sm text-2 mt-2" style={{textAlign:'center'}}>A copy has been sent to {emailAddr}</p>
              <Link to="/login">
                <button className="btn btn-primary btn-block mt-3">Go to Login →</button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
