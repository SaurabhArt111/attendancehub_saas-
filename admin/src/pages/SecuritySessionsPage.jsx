import { useState, useEffect } from 'react'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import BackButton from '../components/BackButton'
import './SettingsPage.css'

export default function SecuritySessionsPage() {
  const [sessions, setSessions] = useState(null)
  const [history, setHistory] = useState(null)
  const [maxDevices, setMaxDevices] = useState(3)
  const [loading, setLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [busyId, setBusyId] = useState(null)

  function load() {
    setLoading(true)
    Promise.all([api.get('/admin/sessions'), api.get('/admin/sessions/history')])
      .then(([sRes, hRes]) => {
        setSessions(sRes.data.sessions)
        setMaxDevices(sRes.data.maxDevices)
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
        <BackButton fallback="/settings" />
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
                  signed out automatically when you log in on a {maxDevices + 1}th device
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
                  <div className="text-sm font-600">New-device approval</div>
                  <div className="text-xs text-2">Signing in on a new device while you're already signed in elsewhere requires a security key, entered from a trusted device via "Login Code for Another Session" in Settings.</div>
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

function LogoutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
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
