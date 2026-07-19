import { useNavigate } from 'react-router-dom'
import { useThemePref } from '../utils/theme'

export default function ProfilePage() {
  const nav  = useNavigate()
  const user = (() => { try { return JSON.parse(localStorage.getItem('employeeUser') || '{}') } catch { return {} } })()
  const initials = user?.username?.slice(0,2).toUpperCase() || 'U'
  const { pref: theme, resolved: resolvedTheme, setPref: setTheme } = useThemePref()

  function logout() {
    localStorage.removeItem('employeeToken')
    localStorage.removeItem('employeeUser')
    nav('/login')
  }

  const fields = [
    ['Employee ID',   user?.employeeId],
    ['Name',          user?.username],
    ['Designation',   user?.designation || 'Not assigned'],
    ['Contact',       user?.contact || 'Not set'],
    ['Company',       user?.company?.name],
  ]

  return (
    <div className="fade-in">
      <div className="font-700 mb-2" style={{ fontSize:'1.1rem' }}>Profile</div>

      <div className="card mb-2" style={{ textAlign:'center' }}>
        <div className="avatar" style={{ width:68,height:68,fontSize:'1.65rem',borderRadius:16,margin:'0 auto .9rem' }}>
          {initials}
        </div>
        <div className="font-700" style={{ fontSize:'1.1rem' }}>{user?.username}</div>
        <div style={{ fontFamily:'monospace',color:'var(--accent)',fontWeight:700,fontSize:'1rem',marginTop:'.2rem',letterSpacing:'.05em' }}>
          {user?.employeeId}
        </div>
        {user?.designation && <div className="text-sm text-2 mt-1">{user.designation}</div>}
      </div>

      <div className="card mb-2">
        <div className="font-600 mb-1 text-sm">Account Details</div>
        <div style={{ display:'flex',flexDirection:'column',gap:'.45rem' }}>
          {fields.map(([k,v]) => v && (
            <div key={k} className="flex justify-between items-center"
              style={{ padding:'.45rem .6rem',background:'var(--bg3)',borderRadius:8 }}>
              <span className="text-sm text-2">{k}</span>
              <span className="font-600 text-sm">{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card mb-2">
        <div className="font-600 mb-1 text-sm">Status Legend</div>
        <div style={{ display:'flex',flexDirection:'column',gap:'.38rem' }}>
          {[
            {c:'P', l:'Present',      d:'Regular workday'},
            {c:'A', l:'Absent',       d:'Absent'},
            {c:'PP',l:'Double Shift', d:'Double shift'},
          ].map(s => (
            <div key={s.c} className="flex items-center gap-2"
              style={{ padding:'.4rem .6rem',background:'var(--bg3)',borderRadius:8 }}>
              <span className={`badge badge-${s.c}`}>{s.c}</span>
              <div><div className="font-600 text-sm">{s.l}</div><div className="text-xs text-2">{s.d}</div></div>
            </div>
          ))}
          <div className="flex items-center gap-2"
            style={{ padding:'.4rem .6rem',background:'var(--bg3)',borderRadius:8 }}>
            <span style={{ width:9,height:9,borderRadius:'50%',background:'var(--warn)',flexShrink:0 }} />
            <div><div className="font-600 text-sm">Remark</div><div className="text-xs text-2">Dot on calendar day — hover/tap to read</div></div>
          </div>
        </div>
      </div>

      <div className="card mb-2">
        <div className="font-600 mb-1 text-sm">Appearance</div>
        <div className="text-xs text-2 mb-2">
          {theme === 'system' ? `Following your device (currently ${resolvedTheme === 'dark' ? 'Dark' : 'Light'})` : theme === 'dark' ? 'Dark' : 'Light'}
        </div>
        <div style={{ display: 'inline-flex', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: '.25rem', gap: '.25rem' }}>
          {[
            { v: 'light', label: 'Light' },
            { v: 'dark', label: 'Dark' },
            { v: 'system', label: 'System' },
          ].map(o => (
            <button key={o.v} type="button" onClick={() => setTheme(o.v)}
              style={{
                padding: '.45rem .85rem', border: 'none', borderRadius: 7, fontFamily: 'inherit',
                fontSize: '.8rem', fontWeight: 600, cursor: 'pointer',
                background: theme === o.v ? 'var(--accent)' : 'transparent',
                color: theme === o.v ? '#fff' : 'var(--text2)'
              }}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <button className="btn btn-secondary btn-block" onClick={logout}
        style={{ color:'var(--danger)', borderColor:'rgba(239,68,68,.3)' }}>
        Sign Out
      </button>
    </div>
  )
}
