import { useState, useEffect, useCallback } from 'react'
import api from '../utils/api'

const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function AttendancePage() {
  const now  = new Date()
  const user = (() => { try { return JSON.parse(localStorage.getItem('employeeUser') || '{}') } catch { return {} } })()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [att,   setAtt]   = useState({})
  const [hols,  setHols]  = useState([])
  const [loading, setLoading] = useState(true)

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
  const holidayDates = new Set(hols.filter(h => h.date.startsWith(monthStr)).map(h => h.date.split('-')[2]))

  const P  = Object.values(att).filter(v => v.status==='P').length
  const A  = Object.values(att).filter(v => v.status==='A').length
  const PP = Object.values(att).filter(v => v.status==='PP').length

  function getCls(d) {
    const ds   = String(d).padStart(2,'0')
    const st   = att[ds]?.status
    const isH  = holidayDates.has(ds)
    const isFut= new Date(year,month,d) > today
    const isTod= new Date(year,month,d).toDateString() === today.toDateString()
    if (isFut) return 'future'
    if (isH && !st) return 'H'
    if (st) return st
    return isTod ? 'today' : ''
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
              return (
                <div key={d} className={`cal-day ${cls}`} title={rem || undefined}>
                  {d}
                  {rem && cls !== 'future' && <span className="remark-dot" />}
                </div>
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
        </div>
      </div>

      {hols.filter(h => h.date.startsWith(monthStr)).length > 0 && (
        <div className="card mt-2">
          <div className="font-600 mb-1 text-sm">Holidays this month</div>
          <div style={{ display:'flex',flexDirection:'column',gap:'.35rem' }}>
            {hols.filter(h => h.date.startsWith(monthStr)).map(h => (
              <div key={h._id} className="flex justify-between"
                style={{ padding:'.38rem .6rem',background:'var(--bg3)',borderRadius:7 }}>
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
