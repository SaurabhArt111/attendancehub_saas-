import { useState, useEffect, useCallback } from 'react'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import './ReportsPage.css'

export default function ReportsPage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const load = useCallback(async () => {
    try {
      const res = await api.get('/reports')
      setData(res.data)
    } catch {
      toast.error('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="reports-page">
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <p className="header-subtitle">View attendance and employee reports</p>
        </div>
      </div>

      <div className="reports-filters">
        <select className="form-input" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All Reports</option>
          <option value="attendance">Attendance</option>
          <option value="performance">Performance</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading reports...</p>
        </div>
      ) : data.length === 0 ? (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
            <line x1="2" y1="20" x2="22" y2="20" />
          </svg>
          <h3>No Reports Available</h3>
          <p>Check back later for reports</p>
        </div>
      ) : (
        <div className="reports-grid">
          {/* Reports content */}
        </div>
      )}
    </div>
  )
}

// HolidaysPage.jsx
import { useState, useEffect, useCallback } from 'react'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import './HolidaysPage.css'

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get('/holidays')
      setHolidays(res.data)
    } catch {
      toast.error('Failed to load holidays')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="holidays-page">
      <div className="page-header">
        <div>
          <h1>Holidays</h1>
          <p className="header-subtitle">Manage company holidays</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Add Holiday</span>
        </button>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading holidays...</p>
        </div>
      ) : holidays.length === 0 ? (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M12 8v4l3 2" />
          </svg>
          <h3>No Holidays Yet</h3>
          <p>Add your first holiday</p>
        </div>
      ) : (
        <div className="holidays-list">
          {holidays.map(h => (
            <div key={h._id} className="holiday-item">
              <span>{h.name}</span>
              <span className="date">{new Date(h.date).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// DesignationsPage.jsx
import { useState, useEffect, useCallback } from 'react'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import './DesignationsPage.css'

export default function DesignationsPage() {
  const [designations, setDesignations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get('/designations')
      setDesignations(res.data)
    } catch {
      toast.error('Failed to load designations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="designations-page">
      <div className="page-header">
        <div>
          <h1>Designations</h1>
          <p className="header-subtitle">Manage job titles and roles</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Add Designation</span>
        </button>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading designations...</p>
        </div>
      ) : designations.length === 0 ? (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" />
          </svg>
          <h3>No Designations Yet</h3>
          <p>Add your first designation</p>
        </div>
      ) : (
        <div className="designations-grid">
          {designations.map(d => (
            <div key={d._id} className="designation-card">
              <h3>{d.name}</h3>
              {d.description && <p>{d.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// SettingsPage.jsx
import { useState, useCallback } from 'react'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import './SettingsPage.css'

export default function SettingsPage() {
  const [settings, setSettings] = useState({})
  const [saving, setSaving] = useState(false)

  const set = k => e => setSettings(p => ({ ...p, [k]: e.target.value }))

  const save = useCallback(async () => {
    setSaving(true)
    try {
      await api.post('/settings', settings)
      toast.success('Settings saved')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }, [settings])

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p className="header-subtitle">Manage your company settings</p>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-section">
          <h2>Company Information</h2>
          <div className="form-group">
            <label>Company Name</label>
            <input className="form-input" value={settings.name || ''} onChange={set('name')} />
          </div>
          <div className="form-group">
            <label>Company Code</label>
            <input className="form-input" value={settings.code || ''} onChange={set('code')} disabled />
          </div>
        </div>

        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? <span className="spinner"></span> : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
