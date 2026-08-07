import { useState, useEffect, useCallback } from 'react'
import api from '../utils/api'
import { toast } from './Toaster'
import './ClockCard.css'

function fmtTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function fmtDuration(startIso, endIso) {
  const ms = new Date(endIso) - new Date(startIso)
  if (ms <= 0) return ''
  const mins = Math.round(ms / 60000)
  const h = Math.floor(mins / 60), m = mins % 60
  return `${h}h ${m}m`
}

// Wraps the browser Geolocation API in a Promise with a sane timeout.
function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject({ code: 0, message: 'unsupported' }); return }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true, timeout: 12000, maximumAge: 0
    })
  })
}

// Employee Clock-In/Clock-Out card. Renders nothing when the company is
// still on the default Admin Attendance method — so nothing changes for any
// company that hasn't opted into this feature.
export default function ClockCard() {
  const [status, setStatus] = useState(null) // clock-status response
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [geoState, setGeoState] = useState('unknown') // unknown | granted | prompt | denied | unsupported
  const [notifState, setNotifState] = useState('unknown')
  const [locError, setLocError] = useState('')

  const load = useCallback(() => {
    api.get('/attendance/clock-status').then(r => setStatus(r.data)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  // Check current permission states so we can show the right prompt before
  // the employee even taps Clock In — this is the "automatic check" the
  // product calls for, done non-intrusively via the Permissions API.
  useEffect(() => {
    if (!navigator.geolocation) { setGeoState('unsupported'); return }
    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' }).then(p => {
        setGeoState(p.state)
        p.onchange = () => setGeoState(p.state)
      }).catch(() => setGeoState('prompt'))
    } else {
      setGeoState('prompt')
    }
    if (!('Notification' in window)) setNotifState('unsupported')
    else setNotifState(Notification.permission)
  }, [])

  async function requestNotifications() {
    try {
      const perm = await Notification.requestPermission()
      setNotifState(perm)
    } catch { /* ignore — non-blocking */ }
  }

  async function handleClock(action) {
    setLocError('')
    setBusy(true)
    try {
      let coords = {}
      try {
        const pos = await getPosition()
        coords = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }
        setGeoState('granted')
      } catch (err) {
        if (err.code === 1) { // PERMISSION_DENIED
          setGeoState('denied')
          setLocError('Location access was denied. Please enable Location for this app in your browser/device settings, then try again.')
        } else if (err.code === 2) { // POSITION_UNAVAILABLE
          setLocError('Your GPS/location service seems to be off. Please enable Location Services and try again.')
        } else if (err.code === 3) { // TIMEOUT
          setLocError('Could not get your location in time. Check your GPS signal and try again.')
        } else {
          setLocError('Location is not available on this device/browser.')
        }
        setBusy(false)
        return
      }

      const { data } = await api.post(`/attendance/clock-${action}`, coords)
      toast.success(action === 'in' ? 'Clocked in successfully' : 'Clocked out successfully')
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || `Failed to clock ${action}`)
    } finally {
      setBusy(false)
    }
  }

  if (loading || !status || status.method !== 'employee') return null

  const { today, geofencing, isWeekend } = status
  const clockedIn = !!today?.clockIn
  const clockedOut = !!today?.clockOut
  const needsLocationPrompt = geoState === 'denied'
  const workplaceNames = geofencing.locations.map(location => location.name).filter(Boolean)
  const recordedLocation = today?.clockOut?.locationName || today?.clockIn?.locationName

  return (
    <div className="card mb-2 clock-card">
      <div className="flex items-center justify-between mb-1">
        <div className="font-600 text-sm">Clock In / Clock Out</div>
        {isWeekend && <span className="clock-weekend-tag">Weekly Off</span>}
      </div>

      {geofencing.enabled && workplaceNames.length > 0 && (
        <div className="clock-workplace"><LocationIcon /> <span>{workplaceNames.join(', ')}</span></div>
      )}

      {clockedIn && (
        <div className="clock-times">
          <div className="clock-time-item">
            <span className="clock-time-label">In</span>
            <span className="clock-time-value">{fmtTime(today.clockIn.time)}</span>
          </div>
          {clockedOut && (
            <>
              <div className="clock-time-item">
                <span className="clock-time-label">Out</span>
                <span className="clock-time-value">{fmtTime(today.clockOut.time)}</span>
              </div>
              <div className="clock-time-item">
                <span className="clock-time-label">Total</span>
                <span className="clock-time-value">{fmtDuration(today.clockIn.time, today.clockOut.time)}</span>
              </div>
            </>
          )}
        </div>
      )}

      {recordedLocation && <div className="clock-location-record">Clocked at {recordedLocation}</div>}

      {needsLocationPrompt && (
        <div className="clock-permission-banner">
          <LocationIcon />
          <div>
            <div className="font-600 text-xs">Location access needed</div>
            <div className="text-xs text-2">Enable Location for this app to Clock In/Out{geofencing.enabled ? ' — your workplace requires it' : ''}.</div>
          </div>
        </div>
      )}
      {locError && <div className="clock-error">{locError}</div>}

      {!clockedIn && (
        <button className="btn btn-primary btn-block" disabled={busy} onClick={() => handleClock('in')}>
          {busy ? <span className="spinner" /> : <><LocationIcon /> Clock In</>}
        </button>
      )}
      {clockedIn && !clockedOut && (
        <button className="btn btn-danger btn-block" disabled={busy} onClick={() => handleClock('out')}>
          {busy ? <span className="spinner" /> : <><LocationIcon /> Clock Out</>}
        </button>
      )}
      {clockedIn && clockedOut && (
        <div className="text-xs text-2" style={{ textAlign: 'center' }}>You've completed attendance for today.</div>
      )}

      {notifState === 'default' && (
        <button className="clock-notif-hint" onClick={requestNotifications}>
          <BellIcon /> Enable notifications for attendance reminders
        </button>
      )}
    </div>
  )
}

function LocationIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
}
function BellIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
}
