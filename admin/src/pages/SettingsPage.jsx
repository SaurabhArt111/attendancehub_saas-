import { useState, useEffect } from 'react'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import './SettingsPage.css'

export default function SettingsPage() {
  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)
  const user = (() => { try { return JSON.parse(localStorage.getItem('adminUser') || '{}') } catch { return {} } })()

  useEffect(() => {
    api.get('/company/info')
      .then(r => setCompany(r.data))
      .catch(() => { })
      .finally(() => setLoading(false))
  }, [])

  function logout() {
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminUser')
    window.location.href = '/login'
  }

  return (
    <div>
      <h1 className="font-700 mb-2" style={{ fontSize: '1.25rem' }}>Settings</h1>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><span className="spinner" /></div>
      ) : (
        <div className="settings-container">
          <div className="card">
            <div className="font-600 mb-2">Company Information</div>
            {company && (
              <div className="settings-list">
                {[
                  ['Company Name', company.name],
                  ['Company Code', company.companyCode],
                  ['Contact', company.contact],
                  ['Registered', new Date(company.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })],
                ].map(([k, v]) => (
                  <div key={k} className="settings-row">
                    <span className="text-sm text-2">{k}</span>
                    <span className="font-600 text-sm">{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="font-600 mb-2">Admin Account</div>
            <div className="settings-list">
              {[
                ['Username', user?.username],
                ['Admin ID', user?.adminId],
                ['Role', user?.isOwner ? 'Primary Admin (Owner)' : 'Admin'],
              ].map(([k, v]) => v && (
                <div key={k} className="settings-row">
                  <span className="text-sm text-2">{k}</span>
                  <span className="font-600 text-sm">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="font-600 mb-1">Attendance Status Legend</div>
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
            <LogoutIcon /> SignOut
          </button>
        </div>
      )}
    </div>
  )
}

function LogoutIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg> }
