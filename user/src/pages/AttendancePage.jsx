import { useState, useEffect, useCallback } from 'react'
import api from '../utils/api'

const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

// Color palette for holidays (distinct from attendance)
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

export default function AttendancePage() {
  const now  = new Date()
  const user = (() => { try { return JSON.parse(localStorage.getItem('employeeUser') || '{}') } catch { return {} } })()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [att,   setAtt]   = useState({})
  const [hols,  setHols]  = useState([])
  const [loading, setLoading] = useState(true)
  const [remarkModal, setRemarkModal] = useState(null)

  const monthStr = `${year}-${String(month+1).padStart(2,'0')}`

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const [a, h] = await Promise.all([
        api.get(`/attendance/${user.id}/${monthStr}`),
        api.get('/holidays')
      ])
      setAtt(a.data)
      setHols(h.data)
    } catch {}
    finally { setLoading(false) }
  }, [user?.id, monthStr])

  useEffect(() => { load() }, [load])

  const today = new Date(); today.setHours(0,0,0,0)
  function prevM() { if (month===0) { setYear(y=>y-1); setMonth(11) } else setMonth(m=>m-1) }
  function nextM() { if (new Date(year,month+1,1) > now) return; if (month===11) { setYear(y=>y+1); setMonth(0) } else setMonth(m=>m+1) }

  const daysInMonth  = new Date(year, month+1, 0).getDate()
  const firstDay     = new Date(year, month, 1).getDay()
  const monthHolidays = hols.filter(h => h.date.startsWith(monthStr))
  const holidayMap = new Map(monthHolidays.map(h => [h.date.split('-')[2], h]))

  const P  = Object.values(att).filter(v => v.status==='P').length
  const A  = Object.values(att).filter(v => v.status==='A').length
  const PP = Object.values(att).filter(v => v.status==='PP').length

  function getCls(d) {
    const ds   = String(d).padStart(2,'0')
    const st   = att[ds]?.status
    const holData = holidayMap.get(ds)
    const isFut= new Date(year,month,d) > today
    const isTod= new Date(year,month,d).toDateString() === today.toDateString()
    if (isFut) return 'future'
    if (holData && !st) return 'H'
    if (st) return st
    return isTod ? 'today' : ''
  }

  function openRemarkModal(d) {
    const ds = String(d).padStart(2,'0')
    const rem = att[ds]?.remark
    const holData = holidayMap.get(ds)
    setRemarkModal({
      day: d,
      remark: rem,
      status: att[ds]?.status,
      holiday: holData?.name,
      holidayColor: holData ? getHolidayColor(holData.name) : null
    })
  }

  return (
    <div className="fade-in">
      <div className="font-700 mb-2" style={{ fontSize:'1.1rem' }}>Attendance</div>

      <div className="stats-grid mb-2">
        <div className="stat-card stat-P"><div className="stat-val">{P}</div><div className="stat-lbl">Present</div></div>
        <div className="stat-card stat-A"><div className="stat-val">{A}</div><div className="stat-lbl">Absent</div></div>
        <div className="stat-card stat-PP"><div className="stat-val">{PP}</div><div className="stat-lbl">Double</div></div>
      </div>
      {PP > 0 && <div className="text-xs text-2 mb-2" style={{textAlign:'center'}}>Total effective present: {P + PP*2}</div>}

      <div className="cal-wrap">
        <div className="cal-nav">
          <button className="btn btn-secondary" style={{ padding:'.32rem .7rem', fontSize:'.85rem' }} onClick={prevM}>&#8249;</button>
          <span className="cal-nav-title">{MONTHS[month]} {year}</span>
          <button className="btn btn-secondary" style={{ padding:'.32rem .7rem', fontSize:'.85rem' }} onClick={nextM}
            disabled={new Date(year,month+1,1) > now}>&#8250;</button>
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'1.5rem' }}><span className="spinner" /></div>
        ) : (
          <div className="cal-grid">
            {DAYS.map(d => <div key={d} className="cal-head">{d}</div>)}
            {Array.from({ length: firstDay }).map((_,i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_,i) => {
              const d   = i + 1
              const cls = getCls(d)
              const ds  = String(d).padStart(2,'0')
              const rem = att[ds]?.remark
              const holData = holidayMap.get(ds)
              const hasRemark = rem && cls !== 'future'
              const isClickable = hasRemark || (holData && cls === 'H')
              return (
                <button
                  key={d}
                  type="button"
                  className={`cal-day ${isClickable ? 'clickable' : ''} ${cls}`}
                  title={rem || holData?.name || undefined}
                  onClick={() => isClickable && cls !== 'future' && openRemarkModal(d)}
                  disabled={!isClickable || cls === 'future'}>
                  {d}
                  {hasRemark && <span className="remark-dot" />}
                  {holData && !att[ds]?.status && <span className="holiday-dot" style={{ background: getHolidayColor(holData.name).color }} />}
                </button>
              )
            })}
          </div>
        )}

        <div className="flex gap-2 mt-2" style={{ fontSize:'.72rem', flexWrap:'wrap' }}>
          {[{c:'P',l:'Present'},{c:'A',l:'Absent'},{c:'PP',l:'Double'},{c:'H',l:'Holiday'}].map(s => (
            <span key={s.c} className="flex items-center gap-1">
              <span className={`cal-day ${s.c}`} style={{ width:14,height:14,fontSize:9,borderRadius:4,display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>{s.c}</span>
              {s.l}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span style={{ width:7,height:7,borderRadius:'50%',background:'var(--warn)',display:'inline-block' }} />
            Remark
          </span>
          <span className="flex items-center gap-1">
            <span style={{ width:7,height:7,borderRadius:'50%',background:'#f59e0b',display:'inline-block' }} />
            Holiday
          </span>
        </div>
      </div>

      {monthHolidays.length > 0 && (
        <div className="card mt-2">
          <div className="font-600 mb-1 text-sm">Holidays this month</div>
          <div style={{ display:'flex',flexDirection:'column',gap:'.4rem' }}>
            {monthHolidays.map(h => {
              const holColor = getHolidayColor(h.name)
              return (
                <div key={h._id} className="flex justify-between items-center"
                  style={{ padding:'.55rem .75rem', background: holColor.bg, borderRadius:8, borderLeft: `3px solid ${holColor.color}` }}>
                  <span className="font-600 text-sm" style={{ color: holColor.color }}>{h.name}</span>
                  <span className="text-xs" style={{ color: holColor.color, opacity: 0.7 }}>
                    {new Date(h.date+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',weekday:'short'})}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Enhanced Remark Modal */}
      {remarkModal && (
        <div className="overlay" onClick={() => setRemarkModal(null)}>
          <div className="modal" style={{ maxWidth: 450 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">Details</div>
            
            <div className="mb-2">
              <div className="text-sm text-2" style={{ marginBottom: '.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.03em', fontSize: '.75rem' }}>
                {MONTHS[month]} {remarkModal.day}, {year}
              </div>
              
              {/* Status & Holiday badges */}
              <div className="flex items-center gap-1" style={{ flexWrap: 'wrap' }}>
                {remarkModal.holiday && remarkModal.holidayColor && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '.35rem',
                    padding: '.35rem .7rem',
                    background: remarkModal.holidayColor.bg,
                    color: remarkModal.holidayColor.color,
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: '.8rem'
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: remarkModal.holidayColor.color }} />
                    {remarkModal.holiday}
                  </span>
                )}
                {remarkModal.status && (
                  <span className={`badge badge-${remarkModal.status}`} style={{ fontSize: '.8rem', fontWeight: 600, padding: '.4rem .65rem' }}>
                    {remarkModal.status === 'P' ? 'Present' : remarkModal.status === 'A' ? 'Absent' : 'Double Shift'}
                  </span>
                )}
              </div>
            </div>

            {/* Remark content */}
            {remarkModal.remark ? (
              <div className="mb-2">
                <div className="text-xs text-2 mb-1" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.03em' }}>Remark</div>
                <div className="card" style={{
                  background: 'var(--bg3)',
                  padding: '.75rem',
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                  lineHeight: 1.5,
                  fontSize: '.85rem',
                  borderRadius: 8
                }}>
                  {remarkModal.remark}
                </div>
              </div>
            ) : (
              <div className="text-sm text-2 mb-2" style={{ textAlign: 'center', padding: '1rem 0' }}>
                No remark added
              </div>
            )}

            <button className="btn btn-primary btn-block" onClick={() => setRemarkModal(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
