import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'

const NAV = [
  { to: '/',           label: 'Home',       icon: <HomeIcon /> },
  { to: '/attendance', label: 'Attendance', icon: <CalIcon />  },
  { to: '/profile',    label: 'Profile',    icon: <UserIcon /> },
]

export default function AppShell() {
  const nav  = useNavigate()
  const loc  = useLocation()
  const user = (() => { try { return JSON.parse(localStorage.getItem('employeeUser') || '{}') } catch { return {} } })()
  const [theme, setTheme] = useState(() => localStorage.getItem('userTheme') || 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('userTheme', theme)
  }, [theme])

  function toggleTheme() { setTheme(t => t === 'dark' ? 'light' : 'dark') }

  function logout() {
    localStorage.removeItem('employeeToken')
    localStorage.removeItem('employeeUser')
    nav('/login')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-title">AttendanceHub</div>
        <div className="flex items-center gap-1">
          {user?.company?.name && (
            <span style={{ fontSize: '.72rem', color: 'var(--text2)', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '.15rem .5rem' }}>
              {user.company.name}
            </span>
          )}
          {/* Theme toggle */}
          <button onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
            style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', padding: '.3rem', borderRadius: 6, display:'flex', alignItems:'center' }}>
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <button onClick={logout}
            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '.8rem', padding: '.25rem .5rem', borderRadius: 6 }}>
            LogOut
          </button>
        </div>
      </header>

      <div className="content fade-in">
        <Outlet />
      </div>

      <nav className="bottom-nav">
        {NAV.map(n => {
          const active = n.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(n.to)
          return (
            <button key={n.to} className={`bnav-item ${active ? 'active' : ''}`} onClick={() => nav(n.to)}>
              {n.icon}
              {n.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}

function HomeIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg> }
function CalIcon()  { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> }
function UserIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> }
function SunIcon()  { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> }
function MoonIcon() { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> }
