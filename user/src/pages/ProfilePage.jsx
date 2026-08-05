import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import { useThemePref } from '../utils/theme'
import { Skeleton } from '../components/Skeleton'

export default function ProfilePage() {
  const nav = useNavigate()
  const user = (() => { try { return JSON.parse(localStorage.getItem('employeeUser') || '{}') } catch { return {} } })()
  const initials = user?.username?.slice(0, 2).toUpperCase() || 'U'
  const { pref: theme, resolved: resolvedTheme, setPref: setTheme } = useThemePref()

  const [sessions, setSessions] = useState(null)
  const [maxDevices, setMaxDevices] = useState(3)
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [loggingOut, setLoggingOut] = useState(false)

  function loadSessions() {
    setSessionsLoading(true)
    api.get('/employees/sessions')
      .then(({ data }) => { setSessions(data.sessions); setMaxDevices(data.maxDevices) })
      .catch(() => { })
      .finally(() => setSessionsLoading(false))
  }

  useEffect(() => { loadSessions() }, [])

  async function logout() {
    // Best-effort: tell the server to revoke this device's session so it
    // doesn't keep counting toward the device limit. Sign-out proceeds
    // locally either way.
    setLoggingOut(true)
    try { await api.post('/employees/logout') } catch { /* ignore */ }
    localStorage.removeItem('employeeToken')
    localStorage.removeItem('employeeUser')
    nav('/login')
  }

  async function revokeDevice(id) {
    setBusyId(id)
    try {
      const { data } = await api.post(`/employees/sessions/${id}/revoke`)
      if (data.wasCurrent) {
        localStorage.removeItem('employeeToken')
        localStorage.removeItem('employeeUser')
        window.location.href = '/login'
        return
      }
      toast.success('Device signed out')
      loadSessions()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to sign out device')
    } finally { setBusyId(null) }
  }

  function timeAgo(dateStr) {
    const diffMs = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  const fields = [
    ['Employee ID', user?.employeeId],
    ['Name', user?.username],
    ['Designation', user?.designation || 'Not assigned'],
    ['Contact', user?.contact || 'Not set'],
    ['Company', user?.company?.name],
  ]

  return (
    <div className="fade-in">
      <div className="font-700 mb-2" style={{ fontSize: '1.1rem' }}>Profile</div>

      <div className="card mb-2" style={{ textAlign: 'center' }}>
        <div className="avatar" style={{ width: 68, height: 68, fontSize: '1.65rem', borderRadius: 16, margin: '0 auto .9rem' }}>
          {initials}
        </div>
        <div className="font-700" style={{ fontSize: '1.1rem' }}>{user?.username}</div>
        <div style={{ fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 700, fontSize: '1rem', marginTop: '.2rem', letterSpacing: '.05em' }}>
          {user?.employeeId}
        </div>
        {user?.designation && <div className="text-sm text-2 mt-1">{user.designation}</div>}
      </div>

      <div className="card mb-2">
        <div className="font-600 mb-1 text-sm">Account Details</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.45rem' }}>
          {fields.map(([k, v]) => v && (
            <div key={k} className="flex justify-between items-center"
              style={{ padding: '.45rem .6rem', background: 'var(--bg3)', borderRadius: 8 }}>
              <span className="text-sm text-2">{k}</span>
              <span className="font-600 text-sm">{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card mb-2">
        <div className="font-600 mb-1 text-sm">Status Legend</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.38rem' }}>
          {[
            { c: 'P', l: 'Present', d: 'Regular workday' },
            { c: 'A', l: 'Absent', d: 'Absent' },
            { c: 'PP', l: 'Double Shift', d: 'Double shift' },
          ].map(s => (
            <div key={s.c} className="flex items-center gap-2"
              style={{ padding: '.4rem .6rem', background: 'var(--bg3)', borderRadius: 8 }}>
              <span className={`badge badge-${s.c}`}>{s.c}</span>
              <div><div className="font-600 text-sm">{s.l}</div><div className="text-xs text-2">{s.d}</div></div>
            </div>
          ))}
          <div className="flex items-center gap-2"
            style={{ padding: '.4rem .6rem', background: 'var(--bg3)', borderRadius: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--warn)', flexShrink: 0 }} />
            <div><div className="font-600 text-sm">Remark</div><div className="text-xs text-2">Dot on calendar day — hover/tap to read</div></div>
          </div>
        </div>
      </div>

      <div className="card mb-2">
        <div className="font-600 mb-1 text-sm">Appearance</div>
        <div className="text-xs text-2 mb-2">
          {theme === 'system' ? `Following your device (currently ${resolvedTheme === 'dark' ? 'Dark' : 'Light'})` : theme === 'dark' ? 'Dark' : 'Light'}
        </div>
        <div style={{ display: 'inline-flex', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '.25rem', gap: '.25rem' }}>
          {[
            { v: 'light', label: 'Light' },
            { v: 'dark', label: 'Dark' },
            { v: 'system', label: 'System' },
          ].map(o => (
            <button key={o.v} type="button" onClick={() => setTheme(o.v)}
              style={{
                padding: '.45rem .85rem', border: 'none', borderRadius: 7, fontFamily: 'inherit',
                fontSize: '.8rem', fontWeight: 600, cursor: 'pointer',
                background: theme === o.v ? 'var(--accent)' : 'transparent',
                color: theme === o.v ? '#fff' : 'var(--text2)'
              }}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card mb-2">
        <div className="flex justify-between items-center mb-1">
          <div className="font-600 text-sm">Signed-in Devices</div>
          {sessions && <div className="text-xs text-2">{sessions.length}/{maxDevices}</div>}
        </div>
        <div className="text-xs text-2 mb-2">
          A device you're still using stays signed in on its own.
        </div>
        {sessionsLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
            {[0, 1].map(i => (
              <div key={i} className="flex items-center gap-2" style={{ padding: '.5rem .6rem' }}>
                <Skeleton circle width={30} height={30} />
                <div style={{ flex: 1 }}><Skeleton width="60%" height={12} style={{ marginBottom: 6 }} /><Skeleton width="40%" height={10} /></div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.45rem' }}>
            {(sessions || []).map(s => (
              <div key={s.id} className="flex justify-between items-center"
                style={{ padding: '.5rem .6rem', background: 'var(--bg3)', borderRadius: 8 }}>
                <div>
                  <div className="font-600 text-sm">
                    {s.deviceLabel || 'Unknown device'} {s.isCurrent && <span className="text-xs" style={{ color: 'var(--success)' }}>· This device</span>}
                  </div>
                  <div className="text-xs text-2">Active {timeAgo(s.lastActiveAt)}</div>
                </div>
                {!s.isCurrent && (
                  <button className="btn btn-secondary" style={{ padding: '.3rem .6rem', fontSize: '.78rem' }}
                    onClick={() => revokeDevice(s.id)} disabled={busyId === s.id}>
                    {busyId === s.id ? <span className="spinner" /> : 'Sign out'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <button className="btn btn-secondary btn-block" onClick={logout} disabled={loggingOut}
        style={{ color: 'var(--danger)', borderColor: 'rgba(239,68,68,.3)' }}>
        {loggingOut ? <span className="spinner" /> : 'Sign Out'}
      </button>
    </div>
  )
}
