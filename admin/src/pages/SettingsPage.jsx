import { useState, useEffect } from 'react'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import './SettingsPage.css'

const SECTION = { MAIN: 'main', COMPANY: 'company', ADMIN: 'admin', ABOUT: 'about' }

export default function SettingsPage() {
  const [section, setSection] = useState(SECTION.MAIN)
  const [company, setCompany] = useState(null)
  const [adminInfo, setAdminInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [theme, setTheme] = useState(() => localStorage.getItem('adminTheme') || 'dark')

  const storedUser = (() => { try { return JSON.parse(localStorage.getItem('adminUser') || '{}') } catch { return {} } })()

  useEffect(() => {
    api.get('/admin/me')
      .then(r => { setCompany(r.data.company); setAdminInfo(r.data.admin) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('adminTheme', next)
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
  if (section === SECTION.ABOUT) {
    return <AboutSection onBack={() => setSection(SECTION.MAIN)} />
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
                  ['Company Name', company.name],
                  ['Company Code', <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)', letterSpacing: '.05em' }}>{company.companyCode}</span>],
                  ['Contact', company.contact || '—'],
                  ['Email', company.email || '—'],
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

          {/* Appearance */}
          <div className="card">
            <div className="settings-section-header">
              <div>
                <div className="font-700">Appearance</div>
                <div className="text-xs text-2 mt-1">Customize the interface</div>
              </div>
            </div>
            <div className="settings-row mt-2">
              <div>
                <div className="text-sm font-600">Theme</div>
                <div className="text-xs text-2">Currently: {theme === 'dark' ? 'Dark' : 'Light'}</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={toggleTheme}>
                {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="card">
            <div className="font-700 mb-1">Attendance Status Legend</div>
            <div className="text-sm text-2 mb-2">The three attendance states used across the system</div>
            <div className="settings-list">
              {[
                { code: 'P',  label: 'Present', desc: 'Employee was present for regular hours',  cls: 'badge-P'  },
                { code: 'A',  label: 'Absent',  desc: 'Employee was absent',                     cls: 'badge-A'  },
                { code: 'PP', label: 'Double',  desc: 'Employee worked a double shift (+2 days)', cls: 'badge-PP' },
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

          {/* About */}
          <button className="settings-nav-btn" onClick={() => setSection(SECTION.ABOUT)}>
            <InfoIcon /> About AttendanceHub
            <ChevronIcon />
          </button>

          <button className="Signout-btn" onClick={logout}>
            <LogoutIcon /> Sign Out
          </button>
        </div>
      )}
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

function AboutSection({ onBack }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <button className="btn btn-secondary btn-sm" onClick={onBack}><BackIcon /> Back</button>
        <h1 className="font-700" style={{ fontSize: '1.1rem' }}>About AttendanceHub</h1>
      </div>
      <div className="about-container">
        <div className="about-hero card">
          <div className="about-logo">AttendanceHub</div>
          <div className="text-sm text-2 mt-1">Workforce Attendance Management for Teams</div>
        </div>

        {[
          {
            title: 'Getting Started',
            icon: <RocketIcon />,
            items: [
              { q: '1. Register Your Company', a: 'Create your company account with a name, contact, email, and password. You\'ll receive a unique Company Code — save it as you\'ll need it to sign in.' },
              { q: '2. Set Up Admin Account', a: 'After registration, create your primary admin account with a name, Admin ID, and password. This admin has full access to manage the system.' },
              { q: '3. Create Designations', a: 'Before adding employees, go to Designations and create the job roles in your company — Manager, Driver, Sales Executive, etc. Employees are assigned from these.' },
              { q: '4. Add Employees', a: 'Add employees individually or in bulk. Each gets an auto-generated Employee ID they use to log in. Set their salary type (monthly or daily rate) and designation.' },
            ]
          },
          {
            title: 'Managing Attendance',
            icon: <CalIcon />,
            items: [
              { q: 'Marking Attendance', a: 'Open any employee\'s card on the Employees page. The calendar lets you tap any past date to mark P (Present), A (Absent), or PP (Double Shift). You can also add a remark per day for notes like advance payments.' },
              { q: 'Attendance Status Types', a: 'P = Present (1 day), A = Absent, PP = Double Shift (counts as 2 days). For daily-rate employees, salary is calculated as daily rate × total present days.' },
              { q: 'Adding Remarks', a: 'When marking attendance, you can add a remark to any day. This appears in monthly reports and is useful for tracking advances, penalties, or other notes.' },
              { q: 'Today\'s Status', a: 'Each employee card on the Employees page shows a colored dot indicating their attendance status for today, so you can see the day\'s summary at a glance.' },
            ]
          },
          {
            title: 'Designations',
            icon: <TagIcon />,
            items: [
              { q: 'Creating Designations', a: 'Go to Designations in the sidebar and add job titles. These are company-specific and shared across all your employees.' },
              { q: 'Renaming a Designation', a: 'Click Rename on any designation. All employees currently assigned that designation are automatically updated — no manual reassignment needed.' },
              { q: 'Protected Deletion', a: 'You cannot delete a designation if any active employee is currently assigned to it. You must reassign or archive those employees first.' },
            ]
          },
          {
            title: 'Reports & Exports',
            icon: <ChartIcon />,
            items: [
              { q: 'Monthly Reports', a: 'Go to Reports and select any month to see a full breakdown: total present, absent, double-shift days, and estimated salary for every employee. Daily-rate salaries are calculated based on actual present count.' },
              { q: 'CSV Export', a: 'Download the monthly report as a CSV file from the Reports page. The CSV can be opened in Excel or Google Sheets for payroll processing.' },
              { q: 'Employee Data Export', a: 'From the Employees page, you can export any individual employee\'s full profile and all their attendance history as a JSON file — useful as a backup before archiving.' },
            ]
          },
          {
            title: 'Holidays',
            icon: <HolIcon />,
            items: [
              { q: 'Adding Holidays', a: 'Go to Holidays to add company holidays by date and name. Holidays appear highlighted in the attendance calendar so admins can see which days are off.' },
              { q: 'Attendance on Holidays', a: 'Holidays don\'t automatically mark attendance — they only appear as a visual indicator. You can still manually mark an employee P, A, or PP on a holiday if they worked.' },
            ]
          },
          {
            title: 'Employee App',
            icon: <PeopleIcon />,
            items: [
              { q: 'Employee Login', a: 'Employees log in to a separate app (employee-facing URL) using their Employee ID and the password set by the admin.' },
              { q: 'What Employees Can See', a: 'Employees can view their own monthly attendance calendar, their profile details, and their designation. They cannot edit attendance or view other employees.' },
            ]
          },
          {
            title: 'Settings & Profile',
            icon: <GearIcon />,
            items: [
              { q: 'Editing Company Info', a: 'From Settings, tap "Edit" next to Company Information to update your company name, contact, email, or password.' },
              { q: 'Editing Admin Profile', a: 'Tap "Edit" next to Admin Account to update your name, contact, email, or password. Changes take effect immediately.' },
              { q: 'Archiving Employees', a: 'Archiving hides an employee from the main list but preserves all their data. Archived employees can be restored or permanently deleted from the Archived section.' },
            ]
          },
        ].map(section => (
          <div key={section.title} className="card about-section">
            <div className="about-section-title">
              <span className="about-section-icon">{section.icon}</span>
              {section.title}
            </div>
            {section.items.map((item, i) => (
              <div key={i} className="about-item">
                <div className="about-item-q">{item.q}</div>
                <div className="about-item-a">{item.a}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// Icons
function EditIcon()   { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> }
function BackIcon()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg> }
function LogoutIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> }
function InfoIcon()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> }
function ChevronIcon(){ return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg> }
function SunIcon()    { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg> }
function MoonIcon()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg> }
function RocketIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg> }
function CalIcon()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> }
function TagIcon()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> }
function ChartIcon()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg> }
function HolIcon()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M12 8v4l2 2"/></svg> }
function PeopleIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> }
function GearIcon()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> }
