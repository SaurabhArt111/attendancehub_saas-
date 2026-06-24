import { useState, useCallback } from 'react'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import './Page.css'
 
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
