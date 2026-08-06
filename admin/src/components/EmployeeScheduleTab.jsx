import { useState, useEffect } from 'react'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import '../pages/AttendanceSettingsPage.css'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Lets an admin override a single employee's weekend schedule independently
// of the company-wide default (Settings → Attendance Settings → Weekend
// Management). Falls back to "Use company default" when no override is set.
export default function EmployeeScheduleTab({ employeeId }) {
  const [companyGlobal, setCompanyGlobal] = useState(null)
  const [override, setOverride] = useState(null) // null = using company default
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      api.get('/settings'),
      api.get(`/employees/${employeeId}`)
    ]).then(([settingsRes, empRes]) => {
      if (cancelled) return
      setCompanyGlobal(settingsRes.data.weekend.global)
      setOverride(Array.isArray(empRes.data.weekendOverride) ? empRes.data.weekendOverride : null)
    }).catch(() => toast.error('Failed to load schedule'))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [employeeId])

  async function useCompanyDefault() {
    setSaving(true)
    try {
      await api.put(`/employees/${employeeId}/weekend`, { override: null })
      setOverride(null)
      toast.success('Now following the company default schedule')
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to update') }
    finally { setSaving(false) }
  }

  async function toggleDay(idx) {
    const base = override || companyGlobal
    const next = [...base]
    next[idx] = !next[idx]
    setSaving(true)
    try {
      await api.put(`/employees/${employeeId}/weekend`, { override: next })
      setOverride(next)
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to update') }
    finally { setSaving(false) }
  }

  if (loading || !companyGlobal) return <div style={{ textAlign: 'center', padding: '1.5rem' }}><span className="spinner" /></div>

  const active = override || companyGlobal
  const usingOverride = !!override

  return (
    <div>
      <div className="flex items-center justify-between mb-2" style={{ flexWrap: 'wrap', gap: '.5rem' }}>
        <div className="text-sm text-2">
          {usingOverride ? 'Custom schedule for this employee' : 'Using company default schedule'}
        </div>
        {usingOverride && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={useCompanyDefault} disabled={saving}>
            Use company default
          </button>
        )}
      </div>
      <div className="weekday-grid">
        {DAY_LABELS.map((label, idx) => {
          const isWeekend = active[idx]
          return (
            <button key={label} type="button" className={`weekday-chip ${isWeekend ? 'weekend' : 'working'}`}
              disabled={saving} onClick={() => toggleDay(idx)}>
              <span className="weekday-chip-label">{label}</span>
              <span className="weekday-chip-status">{isWeekend ? 'Weekend' : 'Working'}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
