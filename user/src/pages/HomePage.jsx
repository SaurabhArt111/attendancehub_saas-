import { useState, useEffect } from 'react'
import api from '../utils/api'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function HomePage() {
  const now  = new Date()
  const user = (() => { try { return JSON.parse(localStorage.getItem('employeeUser') || '{}') } catch { return {} } })()
  const [att,  setAtt]  = useState({})
  const [hols, setHols] = useState([])
  const [loading, setLoading] = useState(true)

  const monthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`

  useEffect(() => {
    if (!user?.id) return
    Promise.all([
      api.get(`/attendance/${user.id}/${monthStr}`),
      api.get('/holidays')
    ]).then(([a,h]) => { setAtt(a.data); setHols(h.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user?.id, monthStr])

  const P  = Object.values(att).filter(v => v.status==='P').length
  const A  = Object.values(att).filter(v => v.status==='A').length
  const PP = Object.values(att).filter(v => v.status==='PP').length

  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
  const todayAtt = att[String(now.getDate()).padStart(2,'0')]
  const todayHol = hols.find(h => h.date === todayStr)
  const upcoming = hols.filter(h => h.date >= todayStr).slice(0, 3)

  const initials = user?.username?.slice(0,2).toUpperCase() || 'U'

  return (
    <div className="fade-in">
      <div className="profile-card">
        <div className="avatar">{initials}</div>
        <div>
          <div className="font-700" style={{ fontSize:'1.02rem' }}>{user?.username}</div>
          {user?.designation && <div className="text-sm text-2">{user.designation}</div>}
          <div style={{ fontFamily:'monospace',color:'var(--accent)',fontWeight:700,fontSize:'.82rem',marginTop:'.2rem',letterSpacing:'.05em' }}>
            {user?.employeeId}
          </div>
          <div className="text-xs text-2 mt-1">{user?.company?.name}</div>
        </div>
      </div>

      <div className="text-xs text-2 mb-1" style={{ textTransform:'uppercase', letterSpacing:'.04em', fontWeight:600 }}>
        {MONTHS[now.getMonth()]} {now.getFullYear()}
      </div>
      <div className="stats-grid mb-2">
        <div className="stat-card stat-P"><div className="stat-val">{P}</div><div className="stat-lbl">Present</div></div>
        <div className="stat-card stat-A"><div className="stat-val">{A}</div><div className="stat-lbl">Absent</div></div>
        <div className="stat-card stat-PP"><div className="stat-val">{PP}</div><div className="stat-lbl">Double</div></div>
      </div>

      <div className="card mb-2">
        <div className="font-600 mb-1 text-sm">Today</div>
        {loading ? <span className="spinner" /> : (
          <div className="flex items-center gap-1">
            {todayHol ? (
              <span className="badge" style={{ background:'rgba(245,158,11,.15)',color:'#f59e0b' }}>{todayHol.name}</span>
            ) : todayAtt ? (
              <span className={`badge badge-${todayAtt.status}`}>
                {{P:'Present',A:'Absent',PP:'Double Shift'}[todayAtt.status]}
              </span>
            ) : (
              <span className="text-sm text-2">Not marked yet</span>
            )}
          </div>
        )}
      </div>

      {upcoming.length > 0 && (
        <div className="card">
          <div className="font-600 mb-1 text-sm">Upcoming Holidays</div>
          <div style={{ display:'flex',flexDirection:'column',gap:'.38rem' }}>
            {upcoming.map(h => (
              <div key={h._id} className="flex justify-between items-center"
                style={{ padding:'.4rem .58rem',background:'var(--bg3)',borderRadius:7 }}>
                <span className="font-600 text-sm">{h.name}</span>
                <span className="text-xs text-2">{new Date(h.date+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
