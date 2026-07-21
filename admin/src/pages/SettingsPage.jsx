import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import { useThemePref, THEME_OPTIONS } from '../utils/theme'
import './SettingsPage.css'

const SECTION = { MAIN: 'main', COMPANY: 'company', ADMIN: 'admin', SESSIONS: 'sessions' }

export default function SettingsPage() {
  const [section, setSection] = useState(SECTION.MAIN)
  const [company, setCompany] = useState(null)
  const [adminInfo, setAdminInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const { pref: theme, resolved: resolvedTheme, setPref: setTheme } = useThemePref()

  const storedUser = (() => { try { return JSON.parse(localStorage.getItem('adminUser') || '{}') } catch { return {} } })()

  useEffect(() => {
    api.get('/admin/me')
      .then(r => { setCompany(r.data.company); setAdminInfo(r.data.admin) })
      .catch(() => { })
      .finally(() => setLoading(false))
  }, [])

  function copyToClipboard(value, label) {
    if (!value) return
    const text = String(value)
    if (!navigator.clipboard) {
      toast.error('Copy not supported')
      return
    }

    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${label} copied`)
    }).catch(() => {
      toast.error('Copy failed')
    })
  }

  function logout() {
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminUser')
    window.location.href = '/login'
  }

  if (section === SECTION.COMPANY && company) {
    return <CompanyEditSection company={company} onBack={() => setSection(SECTION.MAIN)}
      onSaved={updated => { setCompany(prev => ({ ...prev, ...updated })); setSection(SECTION.MAIN) }} />
  }
  if (section === SECTION.ADMIN && adminInfo) {
    return <AdminEditSection admin={adminInfo} onBack={() => setSection(SECTION.MAIN)}
      onSaved={updated => { setAdminInfo(prev => ({ ...prev, ...updated })); setSection(SECTION.MAIN) }} />
  }
  if (section === SECTION.SESSIONS) {
    return <SecuritySessionsSection onBack={() => setSection(SECTION.MAIN)} />
  }
  return (
    <div>
      <h1 className="font-700 mb-2" style={{ fontSize: '1.25rem' }}>Settings</h1>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><span className="spinner" /></div>
      ) : (
        <div className="settings-container">
          {/* Company Card */}
          <div className="card">
            <div className="settings-section-header">
              <div>
                <div className="font-700">Company Information</div>
                <div className="text-xs text-2 mt-1">Manage your company details</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setSection(SECTION.COMPANY)}>
                <EditIcon /> Edit
              </button>
            </div>
            {company && (
              <div className="settings-list mt-2">
                {[
                  { label: 'Company Name', value: company.name },
                  { label: 'Company Code', value: company.companyCode, highlight: true },
                  { label: 'Contact', value: company.contact || '—' },
                  { label: 'Email', value: company.email || '—' },
                  { label: 'Registered', value: new Date(company.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) },
                ].map(({ label, value, highlight }) => (
                  <div key={label} className="settings-row">
                    <span className="text-sm text-2">{label}</span>
                    <span
                      className={`font-600 text-sm settings-copyable ${highlight ? 'copy-highlight' : ''}`}
                      onClick={() => value !== '—' && copyToClipboard(value, label)}
                      title={value !== '—' ? `Click to copy ${label}` : ''}
                    >
                      {highlight ? <span style={{ fontFamily: 'monospace', letterSpacing: '.05em', color: 'var(--primary)' }}>{value}</span> : value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Admin Card */}
          <div className="card">
            <div className="settings-section-header">
              <div>
                <div className="font-700">Admin Account</div>
                <div className="text-xs text-2 mt-1">Your personal admin details</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setSection(SECTION.ADMIN)}>
                <EditIcon /> Edit
              </button>
            </div>
            {adminInfo && (
              <div className="settings-list mt-2">
                {[
                  ['Name', adminInfo.username],
                  ['Admin ID', adminInfo.adminId],
                  ['Contact', adminInfo.contact || '—'],
                  ['Email', adminInfo.email || '—'],
                  ['Role', adminInfo.isOwner ? 'Primary Admin (Owner)' : 'Admin'],
                ].map(([k, v]) => v !== undefined && (
                  <div key={k} className="settings-row">
                    <span className="text-sm text-2">{k}</span>
                    <span className="font-600 text-sm">{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Security & Sessions & Login Code for another sessions */}
          <div className="card">

            <div className="settings-section-header">
              <div>
                <div className="font-700">Security & Sessions</div>
                <div className="text-xs text-2 mt-1">Active devices, login history & security options</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setSection(SECTION.SESSIONS)}>
                <ShieldIcon /> Manage
              </button>
            </div>

            {/* Login Code for Another Session */}
            <div className="settings-section-header">
              <div>
                <div className="font-700"></div>
                <div className="text-xs text-2 mt-1"></div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setSection(SECTION.SESSIONS)}>
                {/* icon and text */}
              </button>
            </div>

          </div>

          {/* Appearance */}
          <div className="card">
            <div className="settings-section-header">
              <div>
                <div className="font-700">Appearance</div>
                <div className="text-xs text-2 mt-1">Customize the interface</div>
              </div>
            </div>
            <div className="settings-row mt-2" style={{ flexWrap: 'wrap', gap: '.75rem' }}>
              <div>
                <div className="text-sm font-600">Theme</div>
                <div className="text-xs text-2">
                  {theme === 'system' ? `Following your device (currently ${resolvedTheme})` : theme === 'dark' ? 'Dark' : 'Light'}
                </div>
              </div>
              <ThemeSegmented value={theme} onChange={setTheme} />
            </div>
          </div>

          {/* Legal & Info */}
          <div className="card">
            <div className="font-700 mb-1">Legal & Info</div>
            <div className="text-sm text-2 mb-2">Learn more about AttendanceHub and how your data is handled</div>
            <div className="settings-list">
              <Link to="/about" className="settings-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                <span className="text-sm text-2">About AttendanceHub</span>
                <span className="font-600 text-sm" style={{ color: 'var(--primary)' }}>View →</span>
              </Link>
              <Link to="/privacy-policy" className="settings-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                <span className="text-sm text-2">Privacy Policy</span>
                <span className="font-600 text-sm" style={{ color: 'var(--primary)' }}>View →</span>
              </Link>
            </div>
          </div>

          {/* Legend */}
          <div className="card">
            <div className="font-700 mb-1">Attendance Status Legend</div>
            <div className="text-sm text-2 mb-2">The three attendance states used across the system</div>
            <div className="settings-list">
              {[
                { code: 'P', label: 'Present', desc: 'Employee was present for regular hours', cls: 'badge-P' },
                { code: 'A', label: 'Absent', desc: 'Employee was absent', cls: 'badge-A' },
                { code: 'PP', label: 'Double', desc: 'Employee worked a double shift', cls: 'badge-PP' },
              ].map(s => (
                <div key={s.code} className="settings-legend-item">
                  <span className={`badge ${s.cls}`}>{s.code}</span>
                  <div>
                    <div className="font-600 text-sm">{s.label}</div>
                    <div className="text-xs text-2">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button className="Signout-btn" onClick={logout}>
            <LogoutIcon /> Sign Out
          </button>
        </div>
      )}
    </div>
  )
}

function ThemeSegmented({ value, onChange }) {
  const OPTS = [
    { v: 'light', label: 'Light', icon: <SunIcon /> },
    { v: 'dark', label: 'Dark', icon: <MoonIcon /> },
    { v: 'system', label: 'System', icon: <SystemIcon /> },
  ]
  return (
    <div className="theme-segmented">
      {OPTS.map(o => (
        <button key={o.v} type="button"
          className={`theme-segmented-btn ${value === o.v ? 'active' : ''}`}
          onClick={() => onChange(o.v)}>
          {o.icon} {o.label}
        </button>
      ))}
    </div>
  )
}

function CompanyEditSection({ company, onBack, onSaved }) {
  const [form, setForm] = useState({
    name: company.name || '', contact: company.contact || '', email: company.email || '',
    currentPassword: '', newPassword: '', confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    if (form.newPassword && form.newPassword !== form.confirmPassword) {
      toast.error('New passwords do not match'); return
    }
    setLoading(true)
    try {
      const payload = { name: form.name, contact: form.contact, email: form.email }
      if (form.newPassword) {
        payload.currentPassword = form.currentPassword
        payload.newPassword = form.newPassword
      }
      const { data } = await api.put('/company/update', payload)
      toast.success('Company updated')
      onSaved(data.company)
    } catch (err) { toast.error(err.response?.data?.error || 'Update failed') }
    finally { setLoading(false) }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <button className="btn btn-secondary btn-sm" onClick={onBack}><BackIcon /> Back</button>
        <h1 className="font-700" style={{ fontSize: '1.1rem' }}>Edit Company Info</h1>
      </div>
      <form onSubmit={submit} className="card">
        <div className="form-group">
          <label className="label">Company Name</label>
          <input className="input" value={form.name} onChange={set('name')} required />
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="label">Contact Number</label>
            <input className="input" value={form.contact} onChange={set('contact')} />
          </div>
          <div className="form-group">
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={set('email')} />
          </div>
        </div>
        <div className="settings-divider" />
        <div className="text-sm font-600 mb-2">Change Password (optional)</div>
        <div className="form-group">
          <label className="label">Current Password</label>
          <input className="input" type="password" placeholder="Required to set new password" value={form.currentPassword} onChange={set('currentPassword')} />
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="label">New Password</label>
            <input className="input" type="password" placeholder="Min 6 characters" value={form.newPassword} onChange={set('newPassword')} />
          </div>
          <div className="form-group">
            <label className="label">Confirm New Password</label>
            <input className="input" type="password" placeholder="Repeat" value={form.confirmPassword} onChange={set('confirmPassword')} />
          </div>
        </div>
        <div className="flex gap-1 mt-2">
          <button type="button" className="btn btn-secondary btn-block" onClick={onBack}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}

function AdminEditSection({ admin, onBack, onSaved }) {
  const [form, setForm] = useState({
    username: admin.username || '', contact: admin.contact || '', email: admin.email || '',
    currentPassword: '', newPassword: '', confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    if (form.newPassword && form.newPassword !== form.confirmPassword) {
      toast.error('New passwords do not match'); return
    }
    setLoading(true)
    try {
      const payload = { username: form.username, contact: form.contact, email: form.email }
      if (form.newPassword) {
        payload.currentPassword = form.currentPassword
        payload.newPassword = form.newPassword
      }
      const { data } = await api.put('/admin/update', payload)
      toast.success('Profile updated')
      // Update stored user info
      const stored = JSON.parse(localStorage.getItem('adminUser') || '{}')
      localStorage.setItem('adminUser', JSON.stringify({ ...stored, username: data.admin.username }))
      onSaved(data.admin)
    } catch (err) { toast.error(err.response?.data?.error || 'Update failed') }
    finally { setLoading(false) }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <button className="btn btn-secondary btn-sm" onClick={onBack}><BackIcon /> Back</button>
        <h1 className="font-700" style={{ fontSize: '1.1rem' }}>Edit Admin Profile</h1>
      </div>
      <form onSubmit={submit} className="card">
        <div className="form-group">
          <label className="label">Name</label>
          <input className="input" value={form.username} onChange={set('username')} required />
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="label">Contact Number</label>
            <input className="input" value={form.contact} onChange={set('contact')} />
          </div>
          <div className="form-group">
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={set('email')} />
          </div>
        </div>
        <div className="settings-divider" />
        <div className="text-sm font-600 mb-2">Change Password (optional)</div>
        <div className="form-group">
          <label className="label">Current Password</label>
          <input className="input" type="password" placeholder="Required to change password" value={form.currentPassword} onChange={set('currentPassword')} />
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="label">New Password</label>
            <input className="input" type="password" placeholder="Min 6 characters" value={form.newPassword} onChange={set('newPassword')} />
          </div>
          <div className="form-group">
            <label className="label">Confirm New Password</label>
            <input className="input" type="password" placeholder="Repeat" value={form.confirmPassword} onChange={set('confirmPassword')} />
          </div>
        </div>
        <div className="flex gap-1 mt-2">
          <button type="button" className="btn btn-secondary btn-block" onClick={onBack}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}

function SecuritySessionsSection({ onBack }) {
  const [sessions, setSessions] = useState(null)
  const [history, setHistory] = useState(null)
  const [maxDevices, setMaxDevices] = useState(3)
  const [currentSessionId, setCurrentSessionId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [busyId, setBusyId] = useState(null)

  function load() {
    setLoading(true)
    Promise.all([api.get('/admin/sessions'), api.get('/admin/sessions/history')])
      .then(([sRes, hRes]) => {
        setSessions(sRes.data.sessions)
        setMaxDevices(sRes.data.maxDevices)
        setCurrentSessionId(sRes.data.currentSessionId)
        setHistory(hRes.data)
      })
      .catch(() => toast.error('Failed to load sessions'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function revoke(id) {
    setBusyId(id)
    try {
      const { data } = await api.post(`/admin/sessions/${id}/revoke`)
      toast.success('Device signed out')
      if (data.wasCurrent) {
        localStorage.removeItem('adminToken')
        localStorage.removeItem('adminUser')
        window.location.href = '/login'
        return
      }
      load()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to sign out device') }
    finally { setBusyId(null) }
  }

  async function logoutOthers() {
    if (!confirm('Sign out every other device? They will need to log in again.')) return
    try {
      const { data } = await api.post('/admin/sessions/logout-others')
      toast.success(`Signed out ${data.count} other device${data.count === 1 ? '' : 's'}`)
      load()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to sign out other devices') }
  }

  function timeAgo(dateStr) {
    const diffMs = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <button className="btn btn-secondary btn-sm" onClick={onBack}><BackIcon /> Back</button>
        <h1 className="font-700" style={{ fontSize: '1.1rem' }}>Security & Sessions</h1>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><span className="spinner" /></div>
      ) : (
        <div className="settings-container">
          <div className="card">
            <div className="settings-section-header">
              <div>
                <div className="font-700">Active Sessions</div>
                <div className="text-xs text-2 mt-1">
                  {sessions?.length || 0} of {maxDevices} devices signed in — the oldest device is
                  signed out automatically when you log in on a {maxDevices + 1}
                  {maxDevices + 1 === 4 ? 'th' : 'th'} device
                </div>
              </div>
              {sessions?.length > 1 && (
                <button className="btn btn-secondary btn-sm" onClick={logoutOthers}>
                  <LogoutIcon /> Sign out others
                </button>
              )}
            </div>
            <div className="settings-list mt-2">
              {(sessions || []).map(s => (
                <div key={s.id} className="session-row">
                  <div className="session-row-icon">
                    {s.deviceType === 'mobile' ? <MobileIcon /> : s.deviceType === 'tablet' ? <TabletIcon /> : <DesktopIcon />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="font-600 text-sm flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
                      {s.deviceLabel}
                      {s.isCurrent && <span className="tag" style={{ fontSize: '.65rem', color: 'var(--success)', borderColor: 'var(--success)' }}>This device</span>}
                    </div>
                    <div className="text-xs text-2 mt-1">
                      Last active {timeAgo(s.lastActiveAt)} · Signed in {timeAgo(s.createdAt)} {s.ip ? `· ${s.ip}` : ''}
                    </div>
                  </div>
                  <button className="btn btn-danger btn-sm" disabled={busyId === s.id} onClick={() => revoke(s.id)}>
                    {busyId === s.id ? <span className="spinner" /> : 'Sign out'}
                  </button>
                </div>
              ))}
              {sessions?.length === 0 && <div className="text-sm text-2">No active sessions found.</div>}
            </div>
          </div>

          <div className="card">
            <div className="settings-section-header">
              <div>
                <div className="font-700">Login History</div>
                <div className="text-xs text-2 mt-1">Recent sign-ins to your admin account</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowHistory(v => !v)}>
                {showHistory ? 'Hide' : 'Show'}
              </button>
            </div>
            {showHistory && (
              <div className="settings-list mt-2">
                {(history || []).map(h => (
                  <div key={h.id} className="session-row">
                    <div className="session-row-icon">
                      {h.deviceType === 'mobile' ? <MobileIcon /> : h.deviceType === 'tablet' ? <TabletIcon /> : <DesktopIcon />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="font-600 text-sm">{h.deviceLabel}</div>
                      <div className="text-xs text-2 mt-1">
                        {new Date(h.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        {h.ip ? ` · ${h.ip}` : ''}
                      </div>
                    </div>
                    <span className={`tag session-status-${h.status.startsWith('active') ? 'active' : h.status.startsWith('signed-out') ? 'revoked' : 'expired'}`}>
                      {h.status}
                    </span>
                  </div>
                ))}
                {history?.length === 0 && <div className="text-sm text-2">No login history yet.</div>}
              </div>
            )}
          </div>

          <div className="card">
            <div className="font-700 mb-1">Security Options</div>
            <div className="settings-list mt-1">
              <div className="settings-row">
                <div>
                  <div className="text-sm font-600">Device limit</div>
                  <div className="text-xs text-2">Max {maxDevices} devices signed in at once</div>
                </div>
              </div>
              <div className="settings-row">
                <div>
                  <div className="text-sm font-600">Sliding sessions</div>
                  <div className="text-xs text-2">Staying active keeps you signed in; 30 days idle signs you out</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function DesktopIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="13" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}

function MobileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="2" width="12" height="20" rx="2" /><line x1="11" y1="18" x2="13" y2="18" />
    </svg>
  )
}

function TabletIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
    </svg>
  )
}

function SystemIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="13" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}
