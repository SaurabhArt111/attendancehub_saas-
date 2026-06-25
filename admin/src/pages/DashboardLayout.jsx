import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import './DashboardLayout.css'

const NAV = [
  { to: '/employees', label: 'Employees', icon: <PeopleIcon /> },
  { to: '/reports', label: 'Reports', icon: <ChartIcon /> },
  { to: '/holidays', label: 'Holidays', icon: <HolIcon /> },
  { to: '/designations', label: 'Designations', icon: <TagIcon /> },
  { to: '/settings', label: 'Settings', icon: <GearIcon /> },
]

export default function DashboardLayout() {
  const nav = useNavigate()
  const loc = useLocation()
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('adminTheme') || 'dark')

  const user = (() => { try { return JSON.parse(localStorage.getItem('adminUser') || '{}') } catch { return {} } })()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('adminTheme', theme)
  }, [theme])

  function toggleTheme() {
    setTheme(p => p === 'dark' ? 'light' : 'dark')
  }

  function logout() {
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminUser')
    nav('/login')
  }

  const currentLabel = NAV.find(n => loc.pathname.startsWith(n.to))?.label || 'Dashboard'

  return (
    <div className="layout">
      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} />}

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-logo">
          AttendanceHub
          <span>{user?.company?.name || user?.username || 'Admin'}</span>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(n => (
            <NavLink key={n.to} to={n.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setOpen(false)}>
              {n.icon} {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="text-xs text-2 mb-1" style={{ letterSpacing: '.01em' }}>
            {user?.username}
          </div>
          {user?.company?.companyCode && (
            <div className="tag mb-1" style={{ display: 'inline-block', fontSize: '.7rem', marginBottom: '.5rem' }}>
              {user.company.companyCode}
            </div>
          )}
          <button className="btn btn-secondary btn-sm btn-block" onClick={logout}>
            <LogoutIcon /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-content">
        <header className="topbar">
          <div className="flex items-center gap-2">
            <button className="menu-btn" onClick={() => setOpen(o => !o)} aria-label="Menu">
              <MenuIcon />
            </button>
            <span className="topbar-title">{currentLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle Theme" style={{ marginRight: '0.25rem' }}>
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            {user?.company?.companyCode && (
              <span className="tag" id="desktop-company-code">{user.company.name}</span>
            )}
          </div>
        </header>

        <main className="page-wrap fade-in">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="bottom-nav">
          {NAV.map(n => {
            const active = loc.pathname.startsWith(n.to)
            return (
              <button key={n.to} className={`bnav-item ${active ? 'active' : ''}`}
                onClick={() => { nav(n.to); setOpen(false) }}>
                {n.icon}
                <span>{n.label}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

function PeopleIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> }
function ChartIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" /></svg> }
function HolIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M12 8v4l2 2" /></svg> }
function TagIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg> }
function GearIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg> }
function MenuIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg> }
function LogoutIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg> }

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}
function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  )
}
