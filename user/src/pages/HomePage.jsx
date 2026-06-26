import { useState, useEffect } from 'react'
import api from '../utils/api'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const STATUS_LABEL = { P: 'Present', A: 'Absent', PP: 'Double Shift' }

// Color palette for holidays (matches AttendancePage)
const HOLIDAY_COLORS = [
  { bg: '#fef3c7', color: '#92400e', name: 'Amber' },
  { bg: '#fce7f3', color: '#831843', name: 'Pink' },
  { bg: '#e0e7ff', color: '#3730a3', name: 'Indigo' },
  { bg: '#f0fdfa', color: '#134e4a', name: 'Teal' },
  { bg: '#fef2f2', color: '#7f1d1d', name: 'Red' },
]

// Hash function for consistent holiday colors
function getHolidayColor(name) {
  if (!name) return HOLIDAY_COLORS[0]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i)
    hash = hash & hash
  }
  const colorIndex = Math.abs(hash) % HOLIDAY_COLORS.length
  return HOLIDAY_COLORS[colorIndex]
}

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
  const todayHol = hols.find(h => h.date?.split('T')[0] === todayStr)
  const upcoming = hols.filter(h => (h.date?.split('T')[0] || h.date) >= todayStr).slice(0, 3)

  // Remarks for current month
  const remarks = Object.entries(att)
    .filter(([, v]) => v.remark)
    .map(([day, v]) => ({ day: parseInt(day, 10), remark: v.remark, status: v.status }))
    .sort((a, b) => b.day - a.day) // Latest first

  const initials = user?.username?.slice(0,2).toUpperCase() || 'U'

  return (
    <div className="fade-in">
      <div className="profile-card">
        <div className="avatar">{initials}</div>
        <div>
          <div className="font-700" style={{ fontSize:'1.02rem' }}>{user?.username}</div>
          {user?.designation && (
            <div className="text-sm text-2" style={{
              display: 'inline-block',
              marginTop: '.25rem',
              padding: '.2rem .55rem',
              background: 'rgba(59, 130, 246, 0.1)',
              color: '#1e40af',
              borderRadius: '.25rem',
              fontWeight: 500
            }}>
              {user.designation}
            </div>
          )}
          <div style={{ fontFamily:'monospace',color:'var(--accent)',fontWeight:700,fontSize:'.82rem',marginTop:'.4rem',letterSpacing:'.05em' }}>
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

      {/* Today card */}
      <div className="card mb-2">
        <div className="font-600 mb-1 text-sm">Today</div>
        {loading ? <span className="spinner" /> : (
          <div className="flex items-center gap-1">
            {todayHol ? (
              <span className="badge" style={{ background:'rgba(245,158,11,.15)',color:'#f59e0b' }}>{todayHol.name}</span>
            ) : todayAtt ? (
              <span className={`badge badge-${todayAtt.status}`}>{STATUS_LABEL[todayAtt.status] || todayAtt.status}</span>
            ) : (
              <span className="text-sm text-2">Not marked yet</span>
            )}
          </div>
        )}
      </div>

      {/* Remarks this month */}
      {!loading && remarks.length > 0 && (
        <div className="card mb-2">
          <div className="font-600 mb-1 text-sm" style={{ display:'flex', alignItems:'center', gap:'.4rem' }}>
            <span style={{ width:8,height:8,borderRadius:'50%',background:'var(--warn)',display:'inline-block' }} />
            Remarks — {MONTHS[now.getMonth()]}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'.5rem' }}>
            {remarks.map(r => (
              <div key={r.day} style={{
                padding: '.65rem .75rem',
                background: 'var(--bg3)',
                borderRadius: 8,
                borderLeft: '3px solid var(--warn)',
              }}>
                <div className="flex items-center justify-between mb-1" style={{ flexWrap: 'wrap', gap: '.5rem' }}>
                  <div style={{
                    fontWeight: 700,
                    fontSize: '.85rem',
                    color: 'var(--text)',
                    minWidth: 32
                  }}>
                    {r.day} {MONTHS[now.getMonth()].slice(0,3)}
                  </div>
                  {r.status && (
                    <span className={`badge badge-${r.status}`} style={{
                      fontSize: '.65rem',
                      padding: '.25rem .5rem',
                      fontWeight: 600
                    }}>
                      {r.status}
                    </span>
                  )}
                </div>
                <div className="text-sm" style={{
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                  color: 'var(--text2)',
                  lineHeight: 1.4
                }}>
                  {r.remark}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming holidays */}
      {upcoming.length > 0 && (
        <div className="card">
          <div className="font-600 mb-1 text-sm">Upcoming Holidays</div>
          <div style={{ display:'flex',flexDirection:'column',gap:'.4rem' }}>
            {upcoming.map(h => {
              const holColor = getHolidayColor(h.name)
              return (
                <div key={h._id} className="flex justify-between items-center"
                  style={{
                    padding: '.55rem .75rem',
                    background: holColor.bg,
                    borderRadius: 8,
                    borderLeft: `3px solid ${holColor.color}`
                  }}>
                  <span className="font-600 text-sm" style={{ color: holColor.color }}>{h.name}</span>
                  <span className="text-xs" style={{ color: holColor.color, opacity: 0.7 }}>
                    {new Date((h.date?.split('T')[0] || h.date)+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',weekday:'short'})}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
