import { useState, useEffect } from 'react'
import api from '../utils/api'
import { toast } from '../components/Toaster'

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

  return (
    <div>
      <h1 className="font-700 mb-2" style={{ fontSize: '1.25rem' }}>Settings</h1>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><span className="spinner" /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card">
            <div className="font-600 mb-2">Company Information</div>
            {company && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.65rem' }}>
                {[
                  ['Company Name', company.name],
                  ['Company Code', company.companyCode],
                  ['Contact',      company.contact],
                  ['Registered',   new Date(company.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center"
                    style={{ padding: '.5rem .75rem', background: 'var(--bg3)', borderRadius: 8 }}>
                    <span className="text-sm text-2">{k}</span>
                    <span className="font-600 text-sm">{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="font-600 mb-2">Admin Account</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.65rem' }}>
              {[
                ['Username', user?.username],
                ['Admin ID', user?.adminId],
                ['Role',     user?.isOwner ? 'Primary Admin (Owner)' : 'Admin'],
              ].map(([k, v]) => v && (
                <div key={k} className="flex justify-between items-center"
                  style={{ padding: '.5rem .75rem', background: 'var(--bg3)', borderRadius: 8 }}>
                  <span className="text-sm text-2">{k}</span>
                  <span className="font-600 text-sm">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="font-600 mb-1">Attendance Status Legend</div>
            <div className="text-sm text-2 mb-2">The three attendance states used across the system</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
              {[
                { code: 'P',  label: 'Present',  desc: 'Employee was present for regular hours', cls: 'badge-P' },
                { code: 'A',  label: 'Absent',   desc: 'Employee was absent', cls: 'badge-A' },
                { code: 'PP', label: 'Double',   desc: 'Employee worked a double shift', cls: 'badge-PP' },
              ].map(s => (
                <div key={s.code} className="flex items-center gap-2"
                  style={{ padding: '.5rem .75rem', background: 'var(--bg3)', borderRadius: 8 }}>
                  <span className={`badge ${s.cls}`}>{s.code}</span>
                  <div>
                    <div className="font-600 text-sm">{s.label}</div>
                    <div className="text-xs text-2">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
