import { useState, useEffect } from 'react'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import BackButton from '../components/BackButton'
import './AttendanceSettingsPage.css'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function AttendanceSettingsPage({ pageTitle = 'Attendance Settings' }) {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [savingMethod, setSavingMethod] = useState(false)
  const [savingWeekend, setSavingWeekend] = useState(false)

  function load() {
    setLoading(true)
    api.get('/settings')
      .then(r => setSettings(r.data))
      .catch(() => toast.error('Failed to load attendance settings'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  async function setMethod(method) {
    if (method === settings.method) return
    setSavingMethod(true)
    try {
      const { data } = await api.put('/settings/attendance-method', { method })
      setSettings(data.settings)
      toast.success(method === 'employee' ? 'Employee Clock-In/Clock-Out enabled' : 'Admin Attendance enabled')
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to update') }
    finally { setSavingMethod(false) }
  }

  async function toggleWeekendDay(idx) {
    const next = [...settings.weekend.global]
    next[idx] = !next[idx]
    setSavingWeekend(true)
    try {
      const { data } = await api.put('/settings/weekend', { global: next })
      setSettings(data.settings)
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to update weekend schedule') }
    finally { setSavingWeekend(false) }
  }

  if (loading || !settings) {
    return <div style={{ textAlign: 'center', padding: '3rem' }}><span className="spinner" /></div>
  }

  const workingDaysCount = settings.weekend.global.filter(w => !w).length

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <BackButton fallback="/settings" />
        <h1 className="font-700" style={{ fontSize: '1.25rem' }}>{pageTitle}</h1>
      </div>

      {/* Attendance Method */}
      <div className="card mb-2">
        <div className="font-700 mb-1">Attendance Method</div>
        <div className="text-sm text-2 mb-2">Choose how attendance is captured for your company.</div>
        <div className="method-options">
          <button type="button" className={`method-option ${settings.method === 'admin' ? 'active' : ''}`}
            disabled={savingMethod} onClick={() => setMethod('admin')}>
            <ShieldIcon />
            <div>
              <div className="font-600 text-sm">Admin Attendance</div>
              <div className="text-xs text-2">You mark attendance manually (default)</div>
            </div>
            {settings.method === 'admin' && <CheckIcon />}
          </button>
          <button type="button" className={`method-option ${settings.method === 'employee' ? 'active' : ''}`}
            disabled={savingMethod} onClick={() => setMethod('employee')}>
            <ClockIcon />
            <div>
              <div className="font-600 text-sm">Employee Clock-In/Clock-Out</div>
              <div className="text-xs text-2">Employees mark their own attendance from the app</div>
            </div>
            {settings.method === 'employee' && <CheckIcon />}
          </button>
        </div>
        <div className="text-xs text-2 mt-2">
          You can always manually add, edit, or override any attendance record from the Attendance tab, regardless of which method is active.
        </div>
      </div>

      {/* Geofencing — only relevant when Employee Clock-In is on, but visible so it can be pre-configured */}
      <GeofencingCard settings={settings} onChange={setSettings} disabled={settings.method !== 'employee'} />

      {/* Weekend Management */}
      <div className="card">
        <div className="font-700 mb-1">Weekend Management</div>
        <div className="text-sm text-2 mb-2">
          Set which days of the week are working days company-wide. Every day starts as a Weekend until you mark it Working.
        </div>
        <div className="weekday-grid">
          {DAY_LABELS.map((label, idx) => {
            const isWeekend = settings.weekend.global[idx]
            return (
              <button key={label} type="button" className={`weekday-chip ${isWeekend ? 'weekend' : 'working'}`}
                disabled={savingWeekend} onClick={() => toggleWeekendDay(idx)}>
                <span className="weekday-chip-label">{label}</span>
                <span className="weekday-chip-status">{isWeekend ? 'Weekend' : 'Working'}</span>
              </button>
            )
          })}
        </div>
        <div className="text-xs text-2 mt-2">
          {workingDaysCount === 0
            ? '⚠ No working days configured yet — every day is currently marked Weekend company-wide.'
            : `${workingDaysCount} working day${workingDaysCount === 1 ? '' : 's'} per week, company-wide.`}
        </div>
        <div className="text-xs text-2 mt-1">
          Need a different schedule for one person? Set it from that employee's profile → Schedule tab.
        </div>
      </div>
    </div>
  )
}

function GeofencingCard({ settings, onChange, disabled }) {
  const [form, setForm] = useState({ name: '', lat: '', lng: '', radiusMeters: 200 })
  const [busy, setBusy] = useState(false)
  const [locating, setLocating] = useState(false)

  async function toggleEnabled() {
    setBusy(true)
    try {
      const { data } = await api.put('/settings/geofencing', { enabled: !settings.geofencing.enabled })
      onChange(data.settings)
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to update') }
    finally { setBusy(false) }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) { toast.error('Geolocation is not supported on this browser'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setForm(f => ({ ...f, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) }))
        setLocating(false)
      },
      () => { toast.error('Could not get your current location'); setLocating(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  async function addLocation(e) {
    e.preventDefault()
    if (!form.name.trim() || form.lat === '' || form.lng === '') {
      toast.error('Name, latitude, and longitude are required'); return
    }
    const locations = [
      ...settings.geofencing.locations,
      { name: form.name.trim(), lat: parseFloat(form.lat), lng: parseFloat(form.lng), radiusMeters: parseInt(form.radiusMeters, 10) || 200 }
    ]
    setBusy(true)
    try {
      const { data } = await api.put('/settings/geofencing', { locations })
      onChange(data.settings)
      setForm({ name: '', lat: '', lng: '', radiusMeters: 200 })
      toast.success('Workplace location added')
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to add location') }
    finally { setBusy(false) }
  }

  async function removeLocation(id) {
    const locations = settings.geofencing.locations.filter(l => l.id !== id)
    setBusy(true)
    try {
      const { data } = await api.put('/settings/geofencing', { locations })
      onChange(data.settings)
      toast.success('Location removed')
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to remove location') }
    finally { setBusy(false) }
  }

  return (
    <div className="card mb-2">
      <div className="settings-section-header mb-1">
        <div>
          <div className="font-700">Geofencing</div>
          <div className="text-xs text-2 mt-1">Require employees to be at a workplace location to Clock In/Out</div>
        </div>
        <label className="switch">
          <input type="checkbox" checked={settings.geofencing.enabled} onChange={toggleEnabled} disabled={busy} />
          <span className="switch-track"><span className="switch-thumb" /></span>
        </label>
      </div>

      {disabled && (
        <div className="text-xs" style={{ color: 'var(--warn)', marginBottom: '.75rem' }}>
          Enable "Employee Clock-In/Clock-Out" above for geofencing to take effect.
        </div>
      )}

      {settings.geofencing.locations.length > 0 && (
        <div className="location-list mb-2">
          {settings.geofencing.locations.map(loc => (
            <div key={loc.id} className="location-row">
              <div className="location-row-icon"><PinIcon /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="font-600 text-sm">{loc.name}</div>
                <div className="text-xs text-2">{loc.lat.toFixed(5)}, {loc.lng.toFixed(5)} · {loc.radiusMeters}m radius</div>
              </div>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => removeLocation(loc.id)} disabled={busy}>Remove</button>
            </div>
          ))}
        </div>
      )}

      <div className="settings-divider" />
      <div className="text-sm font-600 mb-2">Add a workplace location</div>
      <form onSubmit={addLocation}>
        <div className="form-group">
          <label className="label">Location Name</label>
          <input className="input" placeholder="e.g. Head Office" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="label">Latitude</label>
            <input className="input" type="number" step="any" placeholder="21.170240" value={form.lat}
              onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="label">Longitude</label>
            <input className="input" type="number" step="any" placeholder="72.831062" value={form.lng}
              onChange={e => setForm(f => ({ ...f, lng: e.target.value }))} />
          </div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="label">Allowed Radius (meters)</label>
            <input className="input" type="number" min="10" max="20000" value={form.radiusMeters}
              onChange={e => setForm(f => ({ ...f, radiusMeters: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="label">&nbsp;</label>
            <button type="button" className="btn btn-secondary btn-block" onClick={useCurrentLocation} disabled={locating}>
              {locating ? <span className="spinner" /> : <><PinIcon /> Use my current location</>}
            </button>
          </div>
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? <span className="spinner" /> : 'Add Location'}
        </button>
      </form>
    </div>
  )
}

function ShieldIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg> }
function ClockIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg> }
function CheckIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> }
function PinIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg> }
